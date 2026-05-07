import { KnownEmailSendStatus } from "@azure/communication-email";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
	emailErrorMessage,
	isAmbiguousEmailTransportError,
	isTransientEmailTransportError,
	createEmailOperationId,
	submitEmail,
} from "../lib/email";
import { staleDispatchThresholdMs } from "./types";
import { emailSendPool } from "./pool";

const STALE_SWEEP_BATCH_SIZE = 256;
const MAX_SEND_ATTEMPTS = 6;

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
			sendAttemptCount: dispatch.sendAttemptCount + 1,
			updatedAt: now,
		});
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
	if (dispatch.sendAttemptCount > MAX_SEND_ATTEMPTS) {
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
		return dispatch.providerOperationId;
	}

	const operationId = createEmailOperationId();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		providerOperationId: operationId,
		providerOperationClaimKey: args.claimKey,
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
	if (dispatch.status !== "sending") return false;

	const now = nowMs();
	await ctx.db.patch("emailDispatches", dispatch._id, {
		status: "submitted",
		providerOperationId: args.providerOperationId,
		providerStatus: args.providerStatus,
		submittedAt: dispatch.submittedAt ?? now,
		error: undefined,
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
 * Failsafe: re-schedule sends for rows stuck without recent progress.
 */
export async function runSweep(ctx: MutationCtx): Promise<{
	claimed: number;
	polled: number;
	staleQueued: number;
}> {
	const now = nowMs();
	const cutoff = now - staleDispatchThresholdMs;
	let rescheduledSend = 0;

	const statuses = ["queued", "sending"] as const;

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
				await emailSendPool.enqueueAction(ctx, internal.emailQueue._sendDispatch, {
					dispatchId: dispatch._id,
					claimKey,
				});
				rescheduledSend += 1;
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
		polled: 0,
		staleQueued,
	};
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

		if (isTerminalProviderStatus(progress.status)) {
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
		const xMsErrorCode =
			maybeError &&
			typeof maybeError === "object" &&
			typeof (maybeError as any).details === "object" &&
			typeof (maybeError as any).details?.xMsErrorCode === "string"
				? ((maybeError as any).details.xMsErrorCode as string)
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
