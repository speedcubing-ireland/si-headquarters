import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "../_generated/server";
import {
	createEmailOperationId,
	emailErrorMessage,
	isTransientEmailTransportError,
	pollEmailSend,
	pollEmailSendOperation,
} from "../lib/email";
import { computeExponentialBackoffMs } from "../lib/retry";
import { normalizeEmail } from "../lib/sanitize";
import {
	buildSponsorshipEmailHtml,
	buildSponsorshipEmailPlainText,
	type SponsorshipEmailContext,
} from "../lib/sponsorshipEmailTemplates";
import {
	sponsorshipEmailType,
	type SponsorshipEmailType,
} from "../lib/sponsorshipValidators";

const sponsorshipEmailContextValidator = v.object({
	competitionName: v.optional(v.string()),
	portalUrl: v.optional(v.string()),
	adminUrl: v.optional(v.string()),
	settlementAmountCents: v.optional(v.number()),
	winnerSponsorName: v.optional(v.string()),
	startsAt: v.optional(v.number()),
	endsAt: v.optional(v.number()),
});

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1000;
const STALE_PENDING_THRESHOLD_MS = 5 * 60 * 1000;
const STALE_SENDING_THRESHOLD_MS = 10 * 60 * 1000;
const EMAIL_SEND_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;
const EMAIL_SEND_POLL_INTERVAL_MS = 15_000;
const EMAIL_SEND_TRANSIENT_RETRY_MS = 30_000;

type SponsorshipEmailRecipient = {
	sponsorId?: Id<"sponsors">;
	email: string;
	name?: string;
};

type EnqueueSponsorshipEmailBatchArgs = {
	batchKey: string;
	auctionId?: Id<"sponsorshipAuctions">;
	emailType: SponsorshipEmailType;
	subject: string;
	message: string;
	recipients: SponsorshipEmailRecipient[];
	context?: SponsorshipEmailContext;
	maxAttempts?: number;
};

function computeRetryDelayMs(attempt: number): number {
	return computeExponentialBackoffMs({
		attempt,
		baseDelayMs: RETRY_BASE_DELAY_MS,
		maxDelayMs: RETRY_MAX_DELAY_MS,
	});
}

function buildDispatchIdempotencyKey(args: {
	batchKey: string;
	emailType: SponsorshipEmailType;
	recipient: string;
}): string {
	return `${args.batchKey}:${args.emailType}:${normalizeEmail(args.recipient)}`;
}

function parseClaimAttempt(claimKey: string): number | null {
	const timestampSeparator = claimKey.lastIndexOf(":");
	if (timestampSeparator <= 0) {
		return null;
	}
	const attemptSeparator = claimKey.lastIndexOf(":", timestampSeparator - 1);
	if (attemptSeparator <= 0) {
		return null;
	}
	const attempt = Number(
		claimKey.slice(attemptSeparator + 1, timestampSeparator),
	);
	if (!Number.isInteger(attempt) || attempt <= 0) {
		return null;
	}
	return attempt;
}

function parseClaimTimestamp(claimKey: string): number | null {
	const timestampSeparator = claimKey.lastIndexOf(":");
	if (timestampSeparator <= 0) {
		return null;
	}
	const timestamp = Number(claimKey.slice(timestampSeparator + 1));
	if (!Number.isFinite(timestamp)) {
		return null;
	}
	return timestamp;
}

function hasSendProgressTimedOut(
	claimKey: string,
	lastAttemptAt: number | undefined,
): boolean {
	const claimStartedAt = parseClaimTimestamp(claimKey);
	const timeoutBase = claimStartedAt ?? lastAttemptAt ?? Date.now();
	return timeoutBase + EMAIL_SEND_PROGRESS_TIMEOUT_MS < Date.now();
}

function serializeContext(
	context: SponsorshipEmailContext | undefined,
): string | undefined {
	if (!context) return undefined;
	return JSON.stringify(context);
}

function parseContextJson(
	contextJson: string | undefined,
): SponsorshipEmailContext | undefined {
	if (!contextJson) return undefined;
	try {
		const value = JSON.parse(contextJson) as Record<string, unknown>;
		if (!value || typeof value !== "object") return undefined;
		return {
			competitionName:
				typeof value.competitionName === "string"
					? value.competitionName
					: undefined,
			portalUrl:
				typeof value.portalUrl === "string" ? value.portalUrl : undefined,
			adminUrl: typeof value.adminUrl === "string" ? value.adminUrl : undefined,
			settlementAmountCents:
				typeof value.settlementAmountCents === "number"
					? value.settlementAmountCents
					: undefined,
			winnerSponsorName:
				typeof value.winnerSponsorName === "string"
					? value.winnerSponsorName
					: undefined,
			startsAt: typeof value.startsAt === "number" ? value.startsAt : undefined,
			endsAt: typeof value.endsAt === "number" ? value.endsAt : undefined,
		};
	} catch {
		return undefined;
	}
}

async function scheduleDispatchProcessing(
	ctx: MutationCtx,
	dispatchId: Id<"sponsorshipEmailDispatches">,
	scheduledFor: number,
): Promise<Id<"_scheduled_functions">> {
	if (scheduledFor <= Date.now()) {
		return ctx.scheduler.runAfter(
			0,
			internal.sponsorshipEmails._processDispatch,
			{
				dispatchId,
			},
		);
	}
	return ctx.scheduler.runAt(
		scheduledFor,
		internal.sponsorshipEmails._processDispatch,
		{
			dispatchId,
		},
	);
}

async function attachDispatchScheduleIfPending(
	ctx: MutationCtx,
	dispatchId: Id<"sponsorshipEmailDispatches">,
	scheduledFunctionId: Id<"_scheduled_functions">,
): Promise<void> {
	const latest = await ctx.db.get("sponsorshipEmailDispatches", dispatchId);
	if (!latest || latest.status !== "pending") {
		await ctx.scheduler.cancel(scheduledFunctionId);
		return;
	}
	await ctx.db.patch("sponsorshipEmailDispatches", dispatchId, {
		scheduledFunctionId,
		updatedAt: Date.now(),
	});
}

async function scheduleRetry(
	ctx: MutationCtx,
	dispatch: Doc<"sponsorshipEmailDispatches">,
	error: string,
): Promise<void> {
	const now = Date.now();
	if (dispatch.attempts >= dispatch.maxAttempts) {
		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			status: "failed",
			error,
			claimKey: undefined,
			scheduledFor: undefined,
			scheduledFunctionId: undefined,
			providerOperationId: undefined,
			providerPollerState: undefined,
			updatedAt: now,
		});
		await ctx.db.insert("sponsorshipEmailDeadLetters", {
			dispatchId: dispatch._id,
			auctionId: dispatch.auctionId,
			sponsorId: dispatch.sponsorId,
			emailType: dispatch.emailType,
			recipient: dispatch.recipient,
			subject: dispatch.subject,
			error,
			attempts: dispatch.attempts,
			payloadJson: dispatch.contextJson,
			failedAt: now,
		});
		return;
	}

	const scheduledFor = now + computeRetryDelayMs(dispatch.attempts);
	await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
		status: "pending",
		error,
		claimKey: undefined,
		scheduledFor,
		scheduledFunctionId: undefined,
		providerOperationId: undefined,
		providerPollerState: undefined,
		updatedAt: now,
	});
	const scheduledFunctionId = await scheduleDispatchProcessing(
		ctx,
		dispatch._id,
		scheduledFor,
	);
	await attachDispatchScheduleIfPending(ctx, dispatch._id, scheduledFunctionId);
}

export async function enqueueSponsorshipEmailBatch(
	ctx: MutationCtx,
	args: EnqueueSponsorshipEmailBatchArgs,
): Promise<{ queued: number; skipped: number }> {
	requireEmailRecipients(args.recipients);
	const now = Date.now();
	const contextJson = serializeContext(args.context);
	const maxAttempts = args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	let queued = 0;
	let skipped = 0;

	for (const recipient of args.recipients) {
		const recipientEmail = normalizeEmail(recipient.email);
		if (!recipientEmail) {
			skipped += 1;
			continue;
		}

		const idempotencyKey = buildDispatchIdempotencyKey({
			batchKey: args.batchKey,
			emailType: args.emailType,
			recipient: recipientEmail,
		});
		const existing = await ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_idempotency_key", (q) =>
				q.eq("idempotencyKey", idempotencyKey),
			)
			.first();
		if (existing) {
			skipped += 1;
			continue;
		}

		const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
			auctionId: args.auctionId,
			sponsorId: recipient.sponsorId,
			emailType: args.emailType,
			recipient: recipientEmail,
			recipientName: recipient.name,
			subject: args.subject,
			message: args.message,
			contextJson,
			idempotencyKey,
			status: "pending",
			attempts: 0,
			maxAttempts,
			scheduledFor: now,
			scheduledFunctionId: undefined,
			claimKey: undefined,
			lastAttemptAt: undefined,
			providerOperationId: undefined,
			providerPollerState: undefined,
			sentAt: undefined,
			providerMessageId: undefined,
			error: undefined,
			createdAt: now,
			updatedAt: now,
		});

		const scheduledFunctionId = await scheduleDispatchProcessing(
			ctx,
			dispatchId,
			now,
		);
		await attachDispatchScheduleIfPending(ctx, dispatchId, scheduledFunctionId);
		queued += 1;
	}

	return { queued, skipped };
}

export const _processDispatch = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (!dispatch || dispatch.status !== "pending") {
			return null;
		}

		const now = Date.now();
		if (dispatch.scheduledFor !== undefined && dispatch.scheduledFor > now) {
			return null;
		}

		const claimKey = `${dispatch._id}:${dispatch.attempts + 1}:${now}`;
		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			status: "sending",
			attempts: dispatch.attempts + 1,
			claimKey,
			lastAttemptAt: now,
			providerOperationId: createEmailOperationId(),
			providerPollerState: undefined,
			scheduledFor: undefined,
			scheduledFunctionId: undefined,
			updatedAt: now,
		});

		await ctx.scheduler.runAfter(
			0,
			internal.sponsorshipEmails._deliverDispatch,
			{
				dispatchId: dispatch._id,
				claimKey,
			},
		);
		return null;
	},
});

export const _getDispatchForDelivery = internalQuery({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			dispatchId: v.id("sponsorshipEmailDispatches"),
			idempotencyKey: v.string(),
			emailType: sponsorshipEmailType,
			recipient: v.string(),
			recipientName: v.optional(v.string()),
			subject: v.string(),
			message: v.string(),
			context: v.optional(sponsorshipEmailContextValidator),
			lastAttemptAt: v.optional(v.number()),
			providerOperationId: v.optional(v.string()),
			providerPollerState: v.optional(v.string()),
		}),
	),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (
			!dispatch ||
			dispatch.status !== "sending" ||
			dispatch.claimKey !== args.claimKey
		) {
			return null;
		}

		return {
			dispatchId: dispatch._id,
			idempotencyKey: dispatch.idempotencyKey,
			emailType: dispatch.emailType,
			recipient: dispatch.recipient,
			recipientName: dispatch.recipientName,
			subject: dispatch.subject,
			message: dispatch.message,
			context: parseContextJson(dispatch.contextJson),
			lastAttemptAt: dispatch.lastAttemptAt,
			providerOperationId: dispatch.providerOperationId,
			providerPollerState: dispatch.providerPollerState,
		};
	},
});

export const _deliverDispatch = internalAction({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const payload = await ctx.runQuery(
			internal.sponsorshipEmails._getDispatchForDelivery,
			{
				dispatchId: args.dispatchId,
				claimKey: args.claimKey,
			},
		);
		if (!payload) {
			return null;
		}

		try {
			const [html, plainText] = await Promise.all([
				buildSponsorshipEmailHtml({
					emailType: payload.emailType,
					recipientName: payload.recipientName,
					context: payload.context,
					messageFallback: payload.message,
				}),
				buildSponsorshipEmailPlainText({
					emailType: payload.emailType,
					recipientName: payload.recipientName,
					context: payload.context,
					messageFallback: payload.message,
				}),
			]);
			const progress = await pollEmailSend({
				to: [
					{ address: payload.recipient, displayName: payload.recipientName },
				],
				subject: payload.subject,
				html,
				plainText,
				operationId: payload.providerOperationId,
				updateIntervalInMs: EMAIL_SEND_POLL_INTERVAL_MS,
			});
			if (progress.status === "Succeeded") {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchSent, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerMessageId: progress.operationId,
				});
				return null;
			}
			if (progress.status === "Failed" || progress.status === "Canceled") {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					error: progress.error ?? "email_send_terminal_failure",
				});
				return null;
			}
			if (hasSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)) {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					error: "dispatch_send_timeout",
				});
				return null;
			}
			await ctx.runMutation(
				internal.sponsorshipEmails._markDispatchInProgress,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerOperationId: progress.operationId,
					providerPollerState: progress.pollerState,
				},
			);
			await ctx.scheduler.runAfter(
				progress.retryAfterMs,
				internal.sponsorshipEmails._pollDispatchDelivery,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
				},
			);
			return null;
		} catch (error) {
			const errorMessage = emailErrorMessage(error);
			if (isTransientEmailTransportError(error)) {
				await ctx.runMutation(
					internal.sponsorshipEmails._markDispatchTransientError,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
						error: errorMessage,
					},
				);
				await ctx.scheduler.runAfter(
					EMAIL_SEND_TRANSIENT_RETRY_MS,
					internal.sponsorshipEmails._pollDispatchDelivery,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
					},
				);
				return null;
			}
			await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
				dispatchId: payload.dispatchId,
				claimKey: args.claimKey,
				error: errorMessage,
			});
			return null;
		}
	},
});

export const _pollDispatchDelivery = internalAction({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const payload = await ctx.runQuery(
			internal.sponsorshipEmails._getDispatchForDelivery,
			{
				dispatchId: args.dispatchId,
				claimKey: args.claimKey,
			},
		);
		if (!payload) {
			return null;
		}
		if (!payload.providerOperationId) {
			await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
				dispatchId: payload.dispatchId,
				claimKey: args.claimKey,
				error: "email_send_operation_id_missing",
			});
			return null;
		}

		try {
			const progress = await pollEmailSendOperation(
				payload.providerOperationId,
			);
			if (progress.status === "Succeeded") {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchSent, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerMessageId: progress.operationId,
				});
				return null;
			}
			if (progress.status === "Failed" || progress.status === "Canceled") {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					error: progress.error ?? "email_send_terminal_failure",
				});
				return null;
			}
			if (hasSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)) {
				await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					error: "dispatch_send_timeout",
				});
				return null;
			}
			await ctx.runMutation(
				internal.sponsorshipEmails._markDispatchInProgress,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerOperationId: progress.operationId,
					providerPollerState: progress.pollerState,
				},
			);
			await ctx.scheduler.runAfter(
				progress.retryAfterMs,
				internal.sponsorshipEmails._pollDispatchDelivery,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
				},
			);
			return null;
		} catch (error) {
			const errorMessage = emailErrorMessage(error);
			if (isTransientEmailTransportError(error)) {
				await ctx.runMutation(
					internal.sponsorshipEmails._markDispatchTransientError,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
						error: errorMessage,
					},
				);
				await ctx.scheduler.runAfter(
					EMAIL_SEND_TRANSIENT_RETRY_MS,
					internal.sponsorshipEmails._pollDispatchDelivery,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
					},
				);
				return null;
			}
			await ctx.runMutation(internal.sponsorshipEmails._markDispatchFailed, {
				dispatchId: payload.dispatchId,
				claimKey: args.claimKey,
				error: errorMessage,
			});
			return null;
		}
	},
});

export const _markDispatchInProgress = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
		providerOperationId: v.string(),
		providerPollerState: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (
			!dispatch ||
			dispatch.status !== "sending" ||
			dispatch.claimKey !== args.claimKey
		) {
			return null;
		}
		const now = Date.now();
		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			providerOperationId: args.providerOperationId,
			providerPollerState:
				args.providerPollerState ?? dispatch.providerPollerState,
			error: undefined,
			lastAttemptAt: now,
			updatedAt: now,
		});
		return null;
	},
});

export const _markDispatchTransientError = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (
			!dispatch ||
			dispatch.status !== "sending" ||
			dispatch.claimKey !== args.claimKey
		) {
			return null;
		}
		const now = Date.now();
		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			error: args.error,
			lastAttemptAt: now,
			updatedAt: now,
		});
		return null;
	},
});

export const _markDispatchSent = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
		providerMessageId: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (!dispatch) {
			return null;
		}

		const isCurrentSendingClaim =
			dispatch.status === "sending" && dispatch.claimKey === args.claimKey;
		const claimAttempt = parseClaimAttempt(args.claimKey);
		const isRecoveredPendingSameAttempt =
			dispatch.status === "pending" &&
			dispatch.claimKey === undefined &&
			claimAttempt !== null &&
			dispatch.attempts === claimAttempt;
		if (!isCurrentSendingClaim && !isRecoveredPendingSameAttempt) {
			return null;
		}

		if (dispatch.scheduledFunctionId) {
			await ctx.scheduler.cancel(dispatch.scheduledFunctionId);
		}

		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			status: "sent",
			claimKey: undefined,
			sentAt: Date.now(),
			providerMessageId: args.providerMessageId ?? dispatch.providerOperationId,
			providerPollerState: undefined,
			error: undefined,
			scheduledFor: undefined,
			scheduledFunctionId: undefined,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const _markDispatchFailed = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
		claimKey: v.string(),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get(
			"sponsorshipEmailDispatches",
			args.dispatchId,
		);
		if (
			!dispatch ||
			dispatch.status !== "sending" ||
			dispatch.claimKey !== args.claimKey
		) {
			return null;
		}
		await scheduleRetry(ctx, dispatch, args.error);
		return null;
	},
});

export const _sweepStaleDispatches = internalMutation({
	args: {},
	returns: v.object({
		requeuedPending: v.number(),
		recoveredSending: v.number(),
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const stalePending = await ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_status_and_scheduled_for", (q) =>
				q
					.eq("status", "pending")
					.lte("scheduledFor", now - STALE_PENDING_THRESHOLD_MS),
			)
			.collect();

		let requeuedPending = 0;
		for (const dispatch of stalePending) {
			await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
				scheduledFor: now,
				scheduledFunctionId: undefined,
				updatedAt: now,
			});
			const scheduledFunctionId = await scheduleDispatchProcessing(
				ctx,
				dispatch._id,
				now,
			);
			await attachDispatchScheduleIfPending(
				ctx,
				dispatch._id,
				scheduledFunctionId,
			);
			requeuedPending += 1;
		}

		const staleSending = await ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_status_and_updated_at", (q) =>
				q
					.eq("status", "sending")
					.lte("updatedAt", now - STALE_SENDING_THRESHOLD_MS),
			)
			.collect();

		let recoveredSending = 0;
		for (const dispatch of staleSending) {
			if (dispatch.claimKey) {
				await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
					updatedAt: now,
					error: "dispatch_recovery_poll",
				});
				await ctx.scheduler.runAfter(
					0,
					internal.sponsorshipEmails._pollDispatchDelivery,
					{
						dispatchId: dispatch._id,
						claimKey: dispatch.claimKey,
					},
				);
			} else {
				await scheduleRetry(ctx, dispatch, "dispatch_send_timeout");
			}
			recoveredSending += 1;
		}

		return { requeuedPending, recoveredSending };
	},
});

function requireEmailRecipients(recipients: { email: string }[]): void {
	if (recipients.length === 0) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "No recipients specified for sponsorship email batch.",
		});
	}
}
