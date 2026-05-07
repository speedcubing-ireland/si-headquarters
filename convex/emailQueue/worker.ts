import { KnownEmailSendStatus } from "@azure/communication-email";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
	emailErrorMessage,
	isAmbiguousEmailTransportError,
	isTransientEmailTransportError,
	createEmailOperationId,
	FALLBACK_RETRY_AFTER_MS,
	pollEmailSendOperation,
	submitEmail,
} from "../lib/email";
import { staleDispatchThresholdMs } from "./types";
import { emailSendPool } from "./pool";
import { bumpDeadLetterHourly, transitionDispatchStatus } from "./counters";

const STALE_SWEEP_BATCH_SIZE = 256;
const MAX_SEND_ATTEMPTS = 6;
const PROVIDER_STATUS_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_SCHEDULER_DELAY_MS = 1000 * 60 * 60 * 24 * 30;

function nowMs(): number {
	return Date.now();
}

function isFailedProviderStatus(status: KnownEmailSendStatus): boolean {
	return (
		status === KnownEmailSendStatus.Failed ||
		status === KnownEmailSendStatus.Canceled
	);
}

function isFinalDispatchStatus(status: Doc<"emailDispatches">["status"]): boolean {
	return (
		status === "dead_letter" ||
		status === "canceled" ||
		status === "delivered" ||
		status === "suppressed" ||
		status === "bounced" ||
		status === "quarantined" ||
		status === "filtered_spam" ||
		status === "failed_delivery"
	);
}

function isProviderStatusTimedOut(dispatch: {
	submittedAt?: number;
	updatedAt: number;
	createdAt: number;
}): boolean {
	const startedAt = dispatch.submittedAt ?? dispatch.updatedAt ?? dispatch.createdAt;
	return startedAt + PROVIDER_STATUS_TIMEOUT_MS < nowMs();
}

export async function claimDispatchForSend(
	ctx: MutationCtx,
	args: { dispatchId: Id<"emailDispatches">; claimKey: string },
): Promise<boolean> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (!dispatch || dispatch.claimKey !== args.claimKey) {
		return false;
	}
	if (
		dispatch.status === "sent" ||
		isFinalDispatchStatus(dispatch.status)
	) {
		return false;
	}
	if (dispatch.status === "awaiting_provider") {
		return false;
	}
	const now = nowMs();
	if (dispatch.status === "queued") {
		await ctx.db.patch("emailDispatches", dispatch._id, {
			status: "sending",
			updatedAt: now,
		});
		await transitionDispatchStatus(ctx, { dispatch, nextStatus: "sending", now });
		return true;
	}
	if (dispatch.status === "sending") {
		return true;
	}
	return false;
}

export async function prepareDispatchSendAttempt(
	ctx: MutationCtx,
	args: { dispatchId: Id<"emailDispatches">; claimKey: string },
): Promise<string | null> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (!dispatch || dispatch.claimKey !== args.claimKey) return null;
	if (dispatch.status !== "sending") return null;
	if (dispatch.sendAttemptCount >= MAX_SEND_ATTEMPTS) {
		await deadLetter(ctx, {
			dispatch,
			error: "send_attempts_exhausted",
			providerStatus: dispatch.providerStatus,
		});
		return null;
	}

	if (
		dispatch.providerOperationClaimKey === args.claimKey &&
		dispatch.providerOperationId
	) {
		await ctx.db.patch("emailDispatches", dispatch._id, {
			sendAttemptCount: dispatch.sendAttemptCount + 1,
			error: undefined,
			updatedAt: nowMs(),
		});
		return dispatch.providerOperationId;
	}

	const operationId = createEmailOperationId();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		providerOperationId: operationId,
		providerOperationClaimKey: args.claimKey,
		sendAttemptCount: dispatch.sendAttemptCount + 1,
		error: undefined,
		updatedAt: nowMs(),
	});
	return operationId;
}

export async function markSent(
	ctx: MutationCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
		providerStatus: string;
	},
): Promise<boolean> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (!dispatch || dispatch.claimKey !== args.claimKey) {
		return false;
	}
	if (dispatch.status === "sent") {
		return true;
	}
	if (
		dispatch.status !== "sending" &&
		dispatch.status !== "awaiting_provider" &&
		dispatch.status !== "submitted"
	) {
		return false;
	}

	const now = nowMs();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		status: "sent",
		sentAt: now,
		providerStatus: args.providerStatus,
		error: undefined,
		updatedAt: now,
	});
	await transitionDispatchStatus(ctx, { dispatch, nextStatus: "sent", now });
	return true;
}

export async function markSubmitted(
	ctx: MutationCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
		providerStatus: string;
		providerOperationId: string;
	},
): Promise<boolean> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (!dispatch || dispatch.claimKey !== args.claimKey) {
		return false;
	}
	if (dispatch.status === "submitted") return true;
	if (dispatch.status !== "sending" && dispatch.status !== "awaiting_provider") {
		return false;
	}

	const now = nowMs();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		status: "submitted",
		providerOperationId: args.providerOperationId,
		providerStatus: args.providerStatus,
		submittedAt: dispatch.submittedAt ?? now,
		error: undefined,
		updatedAt: now,
	});
	await transitionDispatchStatus(ctx, { dispatch, nextStatus: "submitted", now });
	return true;
}

export async function markProviderPoll(
	ctx: MutationCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
		providerStatus: string;
		error?: string;
	},
): Promise<boolean> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (!dispatch || dispatch.claimKey !== args.claimKey) {
		return false;
	}
	if (dispatch.status !== "submitted" && dispatch.status !== "awaiting_provider") {
		return false;
	}
	const now = nowMs();
	const nextStatus = dispatch.status === "awaiting_provider" ? "submitted" : dispatch.status;
	await ctx.db.patch("emailDispatches", dispatch._id, {
		status: nextStatus,
		providerStatus: args.providerStatus,
		pollAttemptCount: dispatch.pollAttemptCount + 1,
		lastProviderCheckAt: now,
		error: args.error,
		updatedAt: now,
	});
	await transitionDispatchStatus(ctx, { dispatch, nextStatus, now });
	return true;
}

export async function deadLetter(
	ctx: MutationCtx,
	args: {
		dispatch: Doc<"emailDispatches">;
		error: string;
		providerStatus?: string;
	},
): Promise<void> {
	if (
		isFinalDispatchStatus(args.dispatch.status) ||
		args.dispatch.status === "sent"
	) {
		return;
	}
	const now = nowMs();
	await ctx.db.patch("emailDispatches", args.dispatch._id, {
		status: "dead_letter",
		providerStatus: args.providerStatus ?? args.dispatch.providerStatus,
		error: args.error,
		deadLetteredAt: now,
		updatedAt: now,
	});
	await transitionDispatchStatus(ctx, {
		dispatch: {
			_id: args.dispatch._id,
			sourceKind: args.dispatch.sourceKind,
			status: args.dispatch.status,
		},
		nextStatus: "dead_letter",
		now,
	});
	const existingDeadLetter = await ctx.db
		.query("emailDeadLetters")
		.withIndex("by_dispatch", (q) => q.eq("dispatchId", args.dispatch._id))
		.first();
	if (existingDeadLetter) {
		await bumpDeadLetterHourly(ctx, {
			at: existingDeadLetter.failedAt,
			delta: -1,
			now,
		});
		await ctx.db.patch("emailDeadLetters", existingDeadLetter._id, {
			error: args.error,
			providerStatus: args.providerStatus ?? args.dispatch.providerStatus,
			sendAttemptCount: args.dispatch.sendAttemptCount,
			pollAttemptCount: args.dispatch.pollAttemptCount,
			failedAt: now,
		});
		await bumpDeadLetterHourly(ctx, { at: now, delta: 1, now });
		return;
	}
	await ctx.db.insert("emailDeadLetters", {
		dispatchId: args.dispatch._id,
		dedupeKey: args.dispatch.dedupeKey,
		sourceKind: args.dispatch.sourceKind,
		sourceRef: args.dispatch.sourceRef,
		templateKey: args.dispatch.templateKey,
		recipientEmail: args.dispatch.recipientEmail,
		subject: args.dispatch.subject,
		error: args.error,
		providerOperationId: args.dispatch.providerOperationId,
		providerStatus: args.providerStatus ?? args.dispatch.providerStatus,
		payloadJson: args.dispatch.payloadJson,
		sendAttemptCount: args.dispatch.sendAttemptCount,
		pollAttemptCount: args.dispatch.pollAttemptCount,
		failedAt: now,
		replayCount: 0,
	});
	await bumpDeadLetterHourly(ctx, { at: now, delta: 1, now });
}

/**
 * Failsafe: re-schedule sends and provider-status polls for rows stuck without recent progress.
 */
export async function runSweep(ctx: MutationCtx): Promise<{
	claimed: number;
	polled: number;
	staleQueued: number;
}> {
	const now = nowMs();
	const cutoff = now - staleDispatchThresholdMs;
	let rescheduledSend = 0;
	let rescheduledPoll = 0;

	const statuses = ["queued", "sending", "submitted", "awaiting_provider"] as const;

	for (const status of statuses) {
		const stale = await ctx.db
			.query("emailDispatches")
			.withIndex("by_status_updated_at", (q) =>
				q.eq("status", status).lt("updatedAt", cutoff),
			)
			.take(STALE_SWEEP_BATCH_SIZE);

		for (const dispatch of stale) {
			let claimKey = dispatch.claimKey;
			if (!claimKey) {
				claimKey = `${dispatch._id}:${nowMs()}`;
				await ctx.db.patch("emailDispatches", dispatch._id, {
					claimKey,
					updatedAt: nowMs(),
				});
			}
			if (status === "queued" || status === "sending") {
				await emailSendPool.enqueueAction(
					ctx,
					internal.emailQueue._sendDispatch,
					{
						dispatchId: dispatch._id,
						claimKey,
					},
					{
						// Match primary enqueue behavior: transient network issues (incl AbortError)
						// should retry with backoff rather than becoming permanent failures.
						retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
					},
				);
				rescheduledSend += 1;
			} else {
				await ctx.scheduler.runAfter(0, internal.emailQueue._pollDispatch, {
					dispatchId: dispatch._id,
					claimKey,
				});
				rescheduledPoll += 1;
			}
		}
	}

	const staleQueuedRows = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_updated_at", (q) =>
			q.eq("status", "queued").lt("updatedAt", cutoff),
		)
		.take(5000);
	const staleQueued = staleQueuedRows.length;

	return {
		claimed: rescheduledSend,
		polled: rescheduledPoll,
		staleQueued,
	};
}

async function scheduleNextPoll(
	ctx: ActionCtx,
	args: { dispatchId: Id<"emailDispatches">; claimKey: string },
	retryAfterMs: number,
): Promise<void> {
	const delayMs = Math.max(
		1,
		Math.min(MAX_SCHEDULER_DELAY_MS, retryAfterMs),
	);
	await ctx.scheduler.runAfter(delayMs, internal.emailQueue._pollDispatch, args);
}

async function loadActionDispatch(
	ctx: ActionCtx,
	dispatchId: Id<"emailDispatches">,
	claimKey: string,
) {
	return ctx.runQuery(internal.emailQueue._getDispatchForClaim, {
		dispatchId,
		claimKey,
	});
}

export async function sendDispatch(
	ctx: ActionCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
	},
): Promise<void> {
	const claimed: boolean = await ctx.runMutation(
		internal.emailQueue._claimDispatchForSend,
		args,
	);
	if (!claimed) {
		return;
	}

	const dispatch = await loadActionDispatch(
		ctx,
		args.dispatchId,
		args.claimKey,
	);
	if (!dispatch) {
		return;
	}

	const operationId: string | null = await ctx.runMutation(
		internal.emailQueue._prepareDispatchSendAttempt,
		args,
	);
	if (!operationId) return;

	try {
		const progress = await submitEmail({
			to: [
				{
					address: dispatch.recipientEmail,
					displayName: dispatch.recipientName,
				},
			],
			subject: dispatch.subject,
			html: dispatch.htmlBody ?? `<p>${dispatch.plainTextBody}</p>`,
			plainText: dispatch.plainTextBody,
			operationId,
			senderAddress: dispatch.senderAddress,
		});

		if (progress.status === KnownEmailSendStatus.Succeeded) {
			await ctx.runMutation(internal.emailQueue._markSent, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: progress.status,
			});
			return;
		}

		if (isFailedProviderStatus(progress.status)) {
			await ctx.runMutation(internal.emailQueue._deadLetter, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				error: progress.error ?? "email_send_terminal_failure",
				providerStatus: progress.status,
			});
			return;
		}

		await ctx.runMutation(internal.emailQueue._markSubmitted, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			providerStatus: progress.status,
			providerOperationId: progress.operationId,
		});
		await scheduleNextPoll(ctx, args, progress.retryAfterMs);
	} catch (error) {
		const message = emailErrorMessage(error);
		const normalized = message.toLowerCase();
		const maybeError = error as
			| {
					code?: unknown;
					statusCode?: unknown;
					details?: { xMsErrorCode?: unknown } | unknown;
			  }
			| undefined;
		const errorCode =
			typeof maybeError?.code === "string" ? maybeError.code : undefined;
		const details =
			maybeError && typeof maybeError === "object"
				? (maybeError as { details?: unknown }).details
				: undefined;
		const xMsErrorCode =
			details && typeof details === "object"
				? typeof (details as { xMsErrorCode?: unknown }).xMsErrorCode === "string"
					? ((details as { xMsErrorCode: string }).xMsErrorCode as string)
					: undefined
				: undefined;
		const statusCode =
			typeof maybeError?.statusCode === "number"
				? maybeError.statusCode
				: undefined;

		// Azure returns this when the operation already exists. That implies a prior
		// submission likely succeeded (or is still running) and we should not retry
		// the send; instead wait for Event Grid delivery reports.
		if (
			errorCode === "OperationIdAlreadyExists" ||
			xMsErrorCode === "OperationIdAlreadyExists" ||
			(statusCode === 400 && normalized.includes("operationidalreadyexists")) ||
			normalized.includes("operationid already exists") ||
			normalized.includes("operation id already exists") ||
			normalized.includes("operationid already exists.")
		) {
			await ctx.runMutation(internal.emailQueue._markSubmitted, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: KnownEmailSendStatus.Running,
				providerOperationId: operationId,
			});
			return;
		}

		console.error("emailQueue.sendDispatch failed", {
			dispatchId: String(args.dispatchId),
			claimKey: args.claimKey,
			operationId,
			error,
		});
		if (
			isTransientEmailTransportError(error) ||
			isAmbiguousEmailTransportError(error)
		) {
			// Let Workpool retry with backoff. We reuse the same operationId for this
			// claimKey so Azure can de-duplicate if the previous request succeeded.
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(message);
		}

		await ctx.runMutation(internal.emailQueue._deadLetter, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			error: message,
			providerStatus: "failed",
		});
	}
}

export async function pollDispatch(
	ctx: ActionCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
	},
): Promise<void> {
	const dispatch = await loadActionDispatch(
		ctx,
		args.dispatchId,
		args.claimKey,
	);
	if (!dispatch) return;

	if (isProviderStatusTimedOut(dispatch)) {
		await ctx.runMutation(internal.emailQueue._deadLetter, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			error: "provider_status_timeout",
			providerStatus: dispatch.providerStatus ?? "unknown",
		});
		return;
	}

	try {
		const progress = await pollEmailSendOperation(dispatch.providerOperationId);
		if (progress.status === KnownEmailSendStatus.Succeeded) {
			await ctx.runMutation(internal.emailQueue._markSent, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: progress.status,
			});
			return;
		}
		if (isFailedProviderStatus(progress.status)) {
			await ctx.runMutation(internal.emailQueue._deadLetter, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				error: progress.error ?? "email_send_terminal_failure",
				providerStatus: progress.status,
			});
			return;
		}
		const marked = await ctx.runMutation(internal.emailQueue._markProviderPoll, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			providerStatus: progress.status,
		});
		if (marked) {
			await scheduleNextPoll(ctx, args, progress.retryAfterMs);
		}
	} catch (error) {
		const message = emailErrorMessage(error);
		if (isProviderStatusTimedOut(dispatch)) {
			await ctx.runMutation(internal.emailQueue._deadLetter, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				error: "provider_status_timeout",
				providerStatus: dispatch.providerStatus ?? "unknown",
			});
			return;
		}
		const marked = await ctx.runMutation(internal.emailQueue._markProviderPoll, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			providerStatus: dispatch.providerStatus ?? "unknown",
			error: message,
		});
		if (marked) {
			await scheduleNextPoll(ctx, args, FALLBACK_RETRY_AFTER_MS);
		}
	}
}
