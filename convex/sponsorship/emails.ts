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
const EMAIL_SEND_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;
const EMAIL_SEND_POLL_INTERVAL_MS = 15_000;
const EMAIL_POLLER_KEY = "default";
const EMAIL_POLLER_INITIAL_DELAY_MS = 0;
const EMAIL_POLLER_DELAY_MS_1_MINUTE = 60_000;
const EMAIL_POLLER_DELAY_MS_5_MINUTES = 5 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_10_MINUTES = 10 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_30_MINUTES = 30 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_1_HOUR = 60 * 60 * 1000;

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

type NotificationDispatchEmailArgs = {
	idempotencyKey: string;
	emailType: "notification_immediate" | "notification_digest";
	recipient: string;
	recipientName?: string;
	subject: string;
	htmlBody: string;
	plainTextBody: string;
	notificationDispatchIds: Id<"notificationDispatches">[];
	notificationClaimKey: string;
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
	const timeoutBase = lastAttemptAt ?? claimStartedAt ?? Date.now();
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

function computeUnsentPollDelayMs(unsentAgeMs: number): number {
	if (unsentAgeMs > EMAIL_POLLER_DELAY_MS_30_MINUTES) {
		return EMAIL_POLLER_DELAY_MS_1_HOUR;
	}
	if (unsentAgeMs > EMAIL_POLLER_DELAY_MS_10_MINUTES) {
		return EMAIL_POLLER_DELAY_MS_30_MINUTES;
	}
	if (unsentAgeMs > EMAIL_POLLER_DELAY_MS_5_MINUTES) {
		return EMAIL_POLLER_DELAY_MS_10_MINUTES;
	}
	if (unsentAgeMs > 2 * 60 * 1000) {
		return EMAIL_POLLER_DELAY_MS_5_MINUTES;
	}
	return EMAIL_POLLER_DELAY_MS_1_MINUTE;
}

async function getPollerState(
	ctx: MutationCtx,
): Promise<Doc<"sponsorshipEmailPollerState"> | null> {
	return ctx.db
		.query("sponsorshipEmailPollerState")
		.withIndex("by_key", (q) => q.eq("key", EMAIL_POLLER_KEY))
		.first();
}

async function scheduleOrResetUnsentPoller(
	ctx: MutationCtx,
	delayMs: number,
	cancelExisting: boolean,
): Promise<void> {
	const now = Date.now();
	const scheduledFor = now + Math.max(0, delayMs);
	const existing = await getPollerState(ctx);
	if (
		cancelExisting &&
		existing?.scheduledFunctionId &&
		existing.scheduledFor !== undefined &&
		existing.scheduledFor > now
	) {
		await ctx.scheduler.cancel(existing.scheduledFunctionId);
	}
	const scheduledFunctionId = await ctx.scheduler.runAt(
		scheduledFor,
		internal.sponsorshipEmails._runUnsentPollSweep,
		{},
	);
	if (existing) {
		await ctx.db.patch("sponsorshipEmailPollerState", existing._id, {
			scheduledFor,
			scheduledFunctionId,
			updatedAt: now,
		});
		return;
	}
	await ctx.db.insert("sponsorshipEmailPollerState", {
		key: EMAIL_POLLER_KEY,
		scheduledFor,
		scheduledFunctionId,
		updatedAt: now,
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
		await queueNotificationDispatchCompletion(ctx, {
			dispatchIds: dispatch.notificationDispatchIds,
			claimKey: dispatch.notificationClaimKey,
			success: false,
			error,
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
}

async function queueNotificationDispatchCompletion(
	ctx: MutationCtx,
	args: {
		dispatchIds: Id<"notificationDispatches">[] | undefined;
		claimKey: string | undefined;
		success: boolean;
		error?: string;
	},
): Promise<void> {
	if (!args.dispatchIds || args.dispatchIds.length === 0 || !args.claimKey) {
		return;
	}
	if (args.success) {
		await ctx.scheduler.runAfter(
			0,
			internal.notifications._markDispatchesSent,
			{
				dispatchIds: args.dispatchIds,
				claimKey: args.claimKey,
			},
		);
		return;
	}
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._markDispatchesFailed,
		{
			dispatchIds: args.dispatchIds,
			claimKey: args.claimKey,
			reason: args.error ?? "email_send_terminal_failure",
		},
	);
}

async function queueNotificationDispatchHeartbeat(
	ctx: MutationCtx,
	dispatch: Doc<"sponsorshipEmailDispatches">,
): Promise<void> {
	if (
		!dispatch.notificationDispatchIds ||
		dispatch.notificationDispatchIds.length === 0 ||
		!dispatch.notificationClaimKey
	) {
		return;
	}
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._markDispatchesInProgress,
		{
			dispatchIds: dispatch.notificationDispatchIds,
			claimKey: dispatch.notificationClaimKey,
			reason: dispatch.notificationClaimKey,
		},
	);
}

async function claimPendingDispatchForDelivery(
	ctx: MutationCtx,
	dispatchId: Id<"sponsorshipEmailDispatches">,
): Promise<string | null> {
	const dispatch = await ctx.db.get("sponsorshipEmailDispatches", dispatchId);
	if (!dispatch || dispatch.status !== "pending") {
		return null;
	}
	const now = Date.now();
	if (dispatch.scheduledFor !== undefined && dispatch.scheduledFor > now) {
		return null;
	}
	if (dispatch.scheduledFunctionId) {
		await ctx.scheduler.cancel(dispatch.scheduledFunctionId);
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
	return claimKey;
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

		await ctx.db.insert("sponsorshipEmailDispatches", {
			auctionId: args.auctionId,
			sponsorId: recipient.sponsorId,
			emailType: args.emailType,
			recipient: recipientEmail,
			recipientName: recipient.name,
			subject: args.subject,
			message: args.message,
			contextJson,
			htmlBody: undefined,
			plainTextBody: undefined,
			notificationDispatchIds: undefined,
			notificationClaimKey: undefined,
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
		queued += 1;
	}

	if (queued > 0) {
		await scheduleOrResetUnsentPoller(ctx, EMAIL_POLLER_INITIAL_DELAY_MS, true);
	}

	return { queued, skipped };
}

async function enqueueNotificationDispatchEmail(
	ctx: MutationCtx,
	args: NotificationDispatchEmailArgs,
): Promise<Id<"sponsorshipEmailDispatches">> {
	const existing = await ctx.db
		.query("sponsorshipEmailDispatches")
		.withIndex("by_idempotency_key", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey),
		)
		.first();
	if (existing) {
		return existing._id;
	}

	const now = Date.now();
	const dispatchId = await ctx.db.insert("sponsorshipEmailDispatches", {
		auctionId: undefined,
		sponsorId: undefined,
		emailType: args.emailType,
		recipient: normalizeEmail(args.recipient) ?? args.recipient,
		recipientName: args.recipientName,
		subject: args.subject,
		message: args.plainTextBody,
		contextJson: undefined,
		htmlBody: args.htmlBody,
		plainTextBody: args.plainTextBody,
		notificationDispatchIds: args.notificationDispatchIds,
		notificationClaimKey: args.notificationClaimKey,
		idempotencyKey: args.idempotencyKey,
		status: "pending",
		attempts: 0,
		maxAttempts: DEFAULT_MAX_ATTEMPTS,
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

	await scheduleOrResetUnsentPoller(ctx, 0, true);
	return dispatchId;
}

export const _enqueueNotificationDispatchEmail = internalMutation({
	args: {
		idempotencyKey: v.string(),
		emailType: v.union(
			v.literal("notification_immediate"),
			v.literal("notification_digest"),
		),
		recipient: v.string(),
		recipientName: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.string(),
		plainTextBody: v.string(),
		notificationDispatchIds: v.array(v.id("notificationDispatches")),
		notificationClaimKey: v.string(),
	},
	returns: v.id("sponsorshipEmailDispatches"),
	handler: async (ctx, args) => enqueueNotificationDispatchEmail(ctx, args),
});

export const _processDispatch = internalMutation({
	args: {
		dispatchId: v.id("sponsorshipEmailDispatches"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const claimKey = await claimPendingDispatchForDelivery(
			ctx,
			args.dispatchId,
		);
		if (!claimKey) {
			return null;
		}
		await ctx.scheduler.runAfter(
			0,
			internal.sponsorshipEmails._deliverDispatch,
			{
				dispatchId: args.dispatchId,
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
			htmlBody: v.optional(v.string()),
			plainTextBody: v.optional(v.string()),
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
			htmlBody: dispatch.htmlBody,
			plainTextBody: dispatch.plainTextBody,
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
			const [html, plainText] =
				payload.htmlBody && payload.plainTextBody
					? [payload.htmlBody, payload.plainTextBody]
					: await Promise.all([
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
			await ctx.runMutation(
				internal.sponsorshipEmails._markDispatchInProgress,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerOperationId: progress.operationId,
					providerPollerState: progress.pollerState,
				},
			);
			return null;
		} catch (error) {
			const errorMessage = emailErrorMessage(error);
			if (isTransientEmailTransportError(error)) {
				if (payload.providerOperationId) {
					try {
						const recoveredProgress = await pollEmailSendOperation(
							payload.providerOperationId,
						);
						if (recoveredProgress.status === "Succeeded") {
							await ctx.runMutation(
								internal.sponsorshipEmails._markDispatchSent,
								{
									dispatchId: payload.dispatchId,
									claimKey: args.claimKey,
									providerMessageId: recoveredProgress.operationId,
								},
							);
							return null;
						}
						if (
							recoveredProgress.status === "Failed" ||
							recoveredProgress.status === "Canceled"
						) {
							await ctx.runMutation(
								internal.sponsorshipEmails._markDispatchFailed,
								{
									dispatchId: payload.dispatchId,
									claimKey: args.claimKey,
									error:
										recoveredProgress.error ?? "email_send_terminal_failure",
								},
							);
							return null;
						}
						await ctx.runMutation(
							internal.sponsorshipEmails._markDispatchInProgress,
							{
								dispatchId: payload.dispatchId,
								claimKey: args.claimKey,
								providerOperationId: recoveredProgress.operationId,
								providerPollerState: recoveredProgress.pollerState,
							},
						);
						return null;
					} catch (pollError) {
						if (!isTransientEmailTransportError(pollError)) {
							await ctx.runMutation(
								internal.sponsorshipEmails._markDispatchFailed,
								{
									dispatchId: payload.dispatchId,
									claimKey: args.claimKey,
									error: emailErrorMessage(pollError),
								},
							);
							return null;
						}
					}
				}
				if (hasSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)) {
					await ctx.runMutation(
						internal.sponsorshipEmails._markDispatchFailed,
						{
							dispatchId: payload.dispatchId,
							claimKey: args.claimKey,
							error: "dispatch_send_timeout",
						},
					);
					return null;
				}
				await ctx.runMutation(
					internal.sponsorshipEmails._markDispatchTransientError,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
						error: errorMessage,
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
			await ctx.runMutation(
				internal.sponsorshipEmails._markDispatchInProgress,
				{
					dispatchId: payload.dispatchId,
					claimKey: args.claimKey,
					providerOperationId: progress.operationId,
					providerPollerState: progress.pollerState,
				},
			);
			return null;
		} catch (error) {
			const errorMessage = emailErrorMessage(error);
			if (isTransientEmailTransportError(error)) {
				if (hasSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)) {
					await ctx.runMutation(
						internal.sponsorshipEmails._markDispatchFailed,
						{
							dispatchId: payload.dispatchId,
							claimKey: args.claimKey,
							error: "dispatch_send_timeout",
						},
					);
					return null;
				}
				await ctx.runMutation(
					internal.sponsorshipEmails._markDispatchTransientError,
					{
						dispatchId: payload.dispatchId,
						claimKey: args.claimKey,
						error: errorMessage,
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
		await queueNotificationDispatchHeartbeat(ctx, dispatch);
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
		const nextError =
			args.error === "Unknown email error" ? dispatch.error : args.error;
		await ctx.db.patch("sponsorshipEmailDispatches", dispatch._id, {
			error: nextError,
			updatedAt: now,
		});
		await queueNotificationDispatchHeartbeat(ctx, dispatch);
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
		await queueNotificationDispatchCompletion(ctx, {
			dispatchIds: dispatch.notificationDispatchIds,
			claimKey: dispatch.notificationClaimKey,
			success: true,
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

type UnsentPollSweepResult = {
	claimedPending: number;
	queuedSendingPolls: number;
	recoveredSending: number;
	unsentCount: number;
	nextDelayMs: number | null;
};

async function runUnsentPollSweep(
	ctx: MutationCtx,
): Promise<UnsentPollSweepResult> {
	const now = Date.now();
	const duePending = await ctx.db
		.query("sponsorshipEmailDispatches")
		.withIndex("by_status_and_scheduled_for", (q) =>
			q.eq("status", "pending").lte("scheduledFor", now),
		)
		.collect();

	let claimedPending = 0;
	for (const dispatch of duePending) {
		const claimKey = await claimPendingDispatchForDelivery(ctx, dispatch._id);
		if (!claimKey) {
			continue;
		}
		await ctx.scheduler.runAfter(
			0,
			internal.sponsorshipEmails._deliverDispatch,
			{
				dispatchId: dispatch._id,
				claimKey,
			},
		);
		claimedPending += 1;
	}

	const sendingDispatches = await ctx.db
		.query("sponsorshipEmailDispatches")
		.withIndex("by_status_and_updated_at", (q) => q.eq("status", "sending"))
		.collect();

	let queuedSendingPolls = 0;
	let recoveredSending = 0;
	for (const dispatch of sendingDispatches) {
		if (dispatch.claimKey) {
			await ctx.scheduler.runAfter(
				0,
				internal.sponsorshipEmails._pollDispatchDelivery,
				{
					dispatchId: dispatch._id,
					claimKey: dispatch.claimKey,
				},
			);
			queuedSendingPolls += 1;
			continue;
		}
		await scheduleRetry(ctx, dispatch, "dispatch_claim_missing");
		recoveredSending += 1;
	}

	const [allPending, latestPending, latestSending] = await Promise.all([
		ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_status_and_created_at", (q) => q.eq("status", "pending"))
			.collect(),
		ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_status_and_created_at", (q) => q.eq("status", "pending"))
			.order("desc")
			.first(),
		ctx.db
			.query("sponsorshipEmailDispatches")
			.withIndex("by_status_and_created_at", (q) => q.eq("status", "sending"))
			.order("desc")
			.first(),
	]);
	const newestUnsentCreatedAt =
		latestPending && latestSending
			? Math.max(latestPending.createdAt, latestSending.createdAt)
			: (latestPending?.createdAt ?? latestSending?.createdAt);
	if (newestUnsentCreatedAt === undefined) {
		const pollerState = await getPollerState(ctx);
		if (pollerState) {
			await ctx.db.patch("sponsorshipEmailPollerState", pollerState._id, {
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				updatedAt: now,
			});
		}
		return {
			claimedPending,
			queuedSendingPolls,
			recoveredSending,
			unsentCount: 0,
			nextDelayMs: null,
		};
	}

	const unsentAgeMs = now - newestUnsentCreatedAt;
	const hasNotificationLinkedUnsent =
		allPending.some(
			(dispatch) =>
				Boolean(dispatch.notificationDispatchIds) &&
				(dispatch.notificationDispatchIds?.length ?? 0) > 0,
		) ||
		sendingDispatches.some(
			(dispatch) =>
				Boolean(dispatch.notificationDispatchIds) &&
				(dispatch.notificationDispatchIds?.length ?? 0) > 0,
		);
	const nextDelayMs = hasNotificationLinkedUnsent
		? EMAIL_POLLER_DELAY_MS_1_MINUTE
		: computeUnsentPollDelayMs(unsentAgeMs);
	await scheduleOrResetUnsentPoller(ctx, nextDelayMs, false);
	return {
		claimedPending,
		queuedSendingPolls,
		recoveredSending,
		unsentCount: allPending.length + sendingDispatches.length,
		nextDelayMs,
	};
}

export const _runUnsentPollSweep = internalMutation({
	args: {},
	returns: v.object({
		claimedPending: v.number(),
		queuedSendingPolls: v.number(),
		recoveredSending: v.number(),
		unsentCount: v.number(),
		nextDelayMs: v.optional(v.number()),
	}),
	handler: async (ctx) => {
		const result = await runUnsentPollSweep(ctx);
		return {
			claimedPending: result.claimedPending,
			queuedSendingPolls: result.queuedSendingPolls,
			recoveredSending: result.recoveredSending,
			unsentCount: result.unsentCount,
			nextDelayMs: result.nextDelayMs ?? undefined,
		};
	},
});

export const _sweepStaleDispatches = internalMutation({
	args: {},
	returns: v.object({
		requeuedPending: v.number(),
		recoveredSending: v.number(),
	}),
	handler: async (ctx) => {
		const result = await runUnsentPollSweep(ctx);
		return {
			requeuedPending: result.claimedPending,
			recoveredSending: result.recoveredSending + result.queuedSendingPolls,
		};
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
