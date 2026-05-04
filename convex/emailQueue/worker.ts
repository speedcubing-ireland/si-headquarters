import { KnownEmailSendStatus } from "@azure/communication-email";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
	emailErrorMessage,
	isAmbiguousEmailTransportError,
	isTransientEmailTransportError,
	pollEmailSend,
	pollEmailSendOperation,
} from "../lib/email";
import { staleDispatchThresholdMs } from "./types";

const PROVIDER_UNKNOWN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const EMAIL_SEND_POLL_INTERVAL_MS = 15_000;

function nowMs(): number {
	return Date.now();
}

function buildClaimKey(dispatchId: Id<"emailDispatches">): string {
	return `${dispatchId}:${nowMs()}`;
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

export async function claimDueQueuedDispatches(
	ctx: MutationCtx,
): Promise<Array<{ dispatchId: Id<"emailDispatches">; claimKey: string }>> {
	const now = nowMs();
	const due = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_scheduled_for", (q) =>
			q.eq("status", "queued").lte("scheduledFor", now),
		)
		.collect();

	const claimed: Array<{
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
	}> = [];
	for (const dispatch of due) {
		const latest = await ctx.db.get("emailDispatches", dispatch._id);
		if (!latest || latest.status !== "queued") {
			continue;
		}
		if (latest.sendAttemptCount > 0) {
			await deadLetter(ctx, {
				dispatch: latest,
				error: "no_auto_resend_policy_enforced",
				providerStatus: latest.providerStatus,
			});
			continue;
		}
		const claimKey = buildClaimKey(latest._id);
		await ctx.db.patch("emailDispatches", latest._id, {
			status: "sending",
			claimKey,
			sendAttemptCount: 1,
			updatedAt: now,
		});
		claimed.push({ dispatchId: latest._id, claimKey });
	}
	return claimed;
}

export async function queuePendingPolls(
	ctx: MutationCtx,
): Promise<Array<{ dispatchId: Id<"emailDispatches">; claimKey: string }>> {
	const awaiting = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_updated_at", (q) =>
			q.eq("status", "awaiting_provider"),
		)
		.collect();

	const polls: Array<{ dispatchId: Id<"emailDispatches">; claimKey: string }> =
		[];
	for (const dispatch of awaiting) {
		if (!dispatch.claimKey) {
			await deadLetter(ctx, {
				dispatch,
				error: "dispatch_claim_missing",
				providerStatus: dispatch.providerStatus,
			});
			continue;
		}
		polls.push({ dispatchId: dispatch._id, claimKey: dispatch.claimKey });
	}
	return polls;
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
		providerPollerState?: string;
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
		providerPollerState:
			args.providerPollerState ?? dispatch.providerPollerState,
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

export async function runSweep(ctx: MutationCtx): Promise<{
	claimed: number;
	polled: number;
	staleQueued: number;
}> {
	const claimed = await claimDueQueuedDispatches(ctx);
	for (const item of claimed) {
		await ctx.scheduler.runAfter(0, internal.emailQueue._sendDispatch, item);
	}

	const polled = await queuePendingPolls(ctx);
	for (const item of polled) {
		await ctx.scheduler.runAfter(0, internal.emailQueue._pollDispatch, item);
	}

	const staleQueued = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_updated_at", (q) => q.eq("status", "queued"))
		.collect();
	const staleCount = staleQueued.filter(
		(dispatch) => dispatch.updatedAt + staleDispatchThresholdMs < nowMs(),
	).length;

	return {
		claimed: claimed.length,
		polled: polled.length,
		staleQueued: staleCount,
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
	const dispatch = await loadActionDispatch(
		ctx,
		args.dispatchId,
		args.claimKey,
	);
	if (!dispatch) {
		return;
	}

	try {
		const progress = await pollEmailSend({
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
			updateIntervalInMs: EMAIL_SEND_POLL_INTERVAL_MS,
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

		await ctx.runMutation(internal.emailQueue._markAwaitingProvider, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			providerStatus: progress.status,
			providerPollerState: progress.pollerState,
		});
	} catch (error) {
		const message = emailErrorMessage(error);
		if (
			isTransientEmailTransportError(error) ||
			isAmbiguousEmailTransportError(error)
		) {
			await ctx.runMutation(internal.emailQueue._markAwaitingProvider, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: "unknown",
				error: message,
			});
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
		await ctx.runMutation(internal.emailQueue._markAwaitingProvider, {
			dispatchId: dispatch._id,
			claimKey: args.claimKey,
			providerStatus: progress.status,
			providerPollerState: progress.pollerState,
		});
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
			await ctx.runMutation(internal.emailQueue._markAwaitingProvider, {
				dispatchId: dispatch._id,
				claimKey: args.claimKey,
				providerStatus: dispatch.providerStatus ?? "unknown",
				error: message,
			});
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
