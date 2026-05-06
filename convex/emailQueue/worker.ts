import { KnownEmailSendStatus } from "@azure/communication-email";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
	emailErrorMessage,
	FALLBACK_RETRY_AFTER_MS,
	isAmbiguousEmailTransportError,
	isTransientEmailTransportError,
	pollEmailSendOperation,
	submitEmail,
} from "../lib/email";
import { staleDispatchThresholdMs } from "./types";

const PROVIDER_UNKNOWN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const STALE_SWEEP_BATCH_SIZE = 256;

function nowMs(): number {
	return Date.now();
}

function isTerminalProviderStatus(status: KnownEmailSendStatus): boolean {
	return (
		status === KnownEmailSendStatus.Succeeded ||
		status === KnownEmailSendStatus.Failed ||
		status === KnownEmailSendStatus.Canceled
	);
}

function hasProviderUnknownTimedOut(dispatch: { createdAt: number }): boolean {
	return dispatch.createdAt + PROVIDER_UNKNOWN_TIMEOUT_MS < nowMs();
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
		dispatch.status === "dead_letter" ||
		dispatch.status === "canceled"
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
			sendAttemptCount: 1,
			updatedAt: now,
		});
		return true;
	}
	if (dispatch.status === "sending") {
		return true;
	}
	return false;
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
		dispatch.status !== "awaiting_provider"
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
	return true;
}

export async function markAwaitingProvider(
	ctx: MutationCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
		providerStatus: string;
		error?: string;
	},
): Promise<boolean> {
	const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
	if (
		!dispatch ||
		dispatch.claimKey !== args.claimKey ||
		(dispatch.status !== "sending" && dispatch.status !== "awaiting_provider")
	) {
		return false;
	}
	const now = nowMs();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		status: "awaiting_provider",
		providerStatus: args.providerStatus,
		pollAttemptCount: dispatch.pollAttemptCount + 1,
		lastProviderCheckAt: now,
		error: args.error,
		updatedAt: now,
	});
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
		args.dispatch.status === "dead_letter" ||
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
	const existingDeadLetter = await ctx.db
		.query("emailDeadLetters")
		.withIndex("by_dispatch", (q) => q.eq("dispatchId", args.dispatch._id))
		.first();
	if (existingDeadLetter) {
		await ctx.db.patch("emailDeadLetters", existingDeadLetter._id, {
			error: args.error,
			providerStatus: args.providerStatus ?? args.dispatch.providerStatus,
			sendAttemptCount: args.dispatch.sendAttemptCount,
			pollAttemptCount: args.dispatch.pollAttemptCount,
			failedAt: now,
		});
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
}

/**
 * Failsafe: re-schedule sends/polls for rows stuck without recent progress.
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

	const statuses = ["queued", "sending", "awaiting_provider"] as const;

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
				await ctx.scheduler.runAfter(0, internal.emailQueue._sendDispatch, {
					dispatchId: dispatch._id,
					claimKey,
				});
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

/** Convex scheduler.runAfter delay clamp (stay within platform limits). */
const MAX_SCHEDULER_DELAY_MS = 1000 * 60 * 60 * 24 * 30;

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
			operationId: dispatch.providerOperationId,
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

		if (isTerminalProviderStatus(progress.status)) {
			await ctx.runMutation(internal.emailQueue._deadLetter, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				error: progress.error ?? "email_send_terminal_failure",
				providerStatus: progress.status,
			});
			return;
		}

		const marked = await ctx.runMutation(
			internal.emailQueue._markAwaitingProvider,
			{
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: progress.status,
			},
		);
		if (marked) {
			await scheduleNextPoll(ctx, args, progress.retryAfterMs);
		}
	} catch (error) {
		const message = emailErrorMessage(error);
		if (
			isTransientEmailTransportError(error) ||
			isAmbiguousEmailTransportError(error)
		) {
			const markedUnknown = await ctx.runMutation(
				internal.emailQueue._markAwaitingProvider,
				{
					dispatchId: dispatch._id,
					claimKey: args.claimKey,
					providerStatus: "unknown",
					error: message,
				},
			);
			if (markedUnknown) {
				await scheduleNextPoll(ctx, args, FALLBACK_RETRY_AFTER_MS);
			}
			return;
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
	if (!dispatch) {
		return;
	}

	if (hasProviderUnknownTimedOut(dispatch)) {
		await ctx.runMutation(internal.emailQueue._deadLetter, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			error: "provider_state_unknown_no_resend",
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
		if (isTerminalProviderStatus(progress.status)) {
			await ctx.runMutation(internal.emailQueue._deadLetter, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				error: progress.error ?? "email_send_terminal_failure",
				providerStatus: progress.status,
			});
			return;
		}
		const markedPoll = await ctx.runMutation(
			internal.emailQueue._markAwaitingProvider,
			{
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: progress.status,
			},
		);
		if (markedPoll) {
			await scheduleNextPoll(ctx, args, progress.retryAfterMs);
		}
	} catch (error) {
		const message = emailErrorMessage(error);
		if (
			isTransientEmailTransportError(error) ||
			isAmbiguousEmailTransportError(error)
		) {
			if (hasProviderUnknownTimedOut(dispatch)) {
				await ctx.runMutation(internal.emailQueue._deadLetter, {
					dispatchId: dispatch._id,
					claimKey: args.claimKey,
					error: "provider_state_unknown_no_resend",
					providerStatus: dispatch.providerStatus ?? "unknown",
				});
				return;
			}
			const markedRetry = await ctx.runMutation(
				internal.emailQueue._markAwaitingProvider,
				{
					dispatchId: dispatch._id,
					claimKey: args.claimKey,
					providerStatus: dispatch.providerStatus ?? "unknown",
					error: message,
				},
			);
			if (markedRetry) {
				await scheduleNextPoll(ctx, args, FALLBACK_RETRY_AFTER_MS);
			}
			return;
		}
		await ctx.runMutation(internal.emailQueue._deadLetter, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			error: message,
			providerStatus: "failed",
		});
	}
}
