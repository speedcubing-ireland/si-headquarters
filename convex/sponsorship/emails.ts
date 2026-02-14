import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "../_generated/server";
import {
	emailErrorMessage,
	isTransientEmailTransportError,
	pollEmailSend,
	pollEmailSendOperation,
} from "../lib/email";
import {
	DEFAULT_MAX_ATTEMPTS,
	EMAIL_SEND_POLL_INTERVAL_MS,
	claimPendingDispatchForDelivery,
	enqueueNotificationDispatchEmail as enqueueNotificationDispatchEmailCore,
	hasDispatchSendProgressTimedOut,
	parseDispatchClaimAttempt,
	queueNotificationDispatchCompletion,
	queueNotificationDispatchHeartbeat,
	runUnsentPollSweep,
	scheduleOrResetUnsentPoller,
	scheduleRetry,
} from "../lib/emailDispatchCore";
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

const EMAIL_POLLER_INITIAL_DELAY_MS = 0;

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

function buildDispatchIdempotencyKey(args: {
	batchKey: string;
	emailType: SponsorshipEmailType;
	recipient: string;
}): string {
	return `${args.batchKey}:${args.emailType}:${normalizeEmail(args.recipient)}`;
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
	returns: v.object({
		dispatchId: v.id("sponsorshipEmailDispatches"),
		status: v.union(
			v.literal("pending"),
			v.literal("sending"),
			v.literal("sent"),
			v.literal("failed"),
		),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args) => enqueueNotificationDispatchEmailCore(ctx, args),
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
				if (
					hasDispatchSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)
				) {
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
				if (
					hasDispatchSendProgressTimedOut(args.claimKey, payload.lastAttemptAt)
				) {
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
		const claimAttempt = parseDispatchClaimAttempt(args.claimKey);
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

function requireEmailRecipients(recipients: { email: string }[]): void {
	if (recipients.length === 0) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "No recipients specified for sponsorship email batch.",
		});
	}
}
