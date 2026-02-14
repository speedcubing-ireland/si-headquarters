import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { createEmailOperationId } from "./email";
import { computeExponentialBackoffMs } from "./retry";
import { normalizeEmail } from "./sanitize";

export const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1000;
const EMAIL_SEND_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;
export const EMAIL_SEND_POLL_INTERVAL_MS = 15_000;
const EMAIL_POLLER_KEY = "default";
const EMAIL_POLLER_DELAY_MS_1_MINUTE = 60_000;
const EMAIL_POLLER_DELAY_MS_5_MINUTES = 5 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_10_MINUTES = 10 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_30_MINUTES = 30 * 60 * 1000;
const EMAIL_POLLER_DELAY_MS_1_HOUR = 60 * 60 * 1000;

export type NotificationEmailDispatchStatus =
	| "pending"
	| "sending"
	| "sent"
	| "failed";

export type EnqueueNotificationDispatchEmailArgs = {
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

export type EnqueueNotificationDispatchEmailResult = {
	dispatchId: Id<"sponsorshipEmailDispatches">;
	status: NotificationEmailDispatchStatus;
	error?: string;
};

export type UnsentPollSweepResult = {
	claimedPending: number;
	queuedSendingPolls: number;
	recoveredSending: number;
	unsentCount: number;
	nextDelayMs: number | null;
};

function computeRetryDelayMs(attempt: number): number {
	return computeExponentialBackoffMs({
		attempt,
		baseDelayMs: RETRY_BASE_DELAY_MS,
		maxDelayMs: RETRY_MAX_DELAY_MS,
	});
}

export function parseDispatchClaimAttempt(claimKey: string): number | null {
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

function parseDispatchClaimTimestamp(claimKey: string): number | null {
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

export function hasDispatchSendProgressTimedOut(
	claimKey: string,
	lastAttemptAt: number | undefined,
): boolean {
	const claimStartedAt = parseDispatchClaimTimestamp(claimKey);
	const timeoutBase = lastAttemptAt ?? claimStartedAt ?? Date.now();
	return timeoutBase + EMAIL_SEND_PROGRESS_TIMEOUT_MS < Date.now();
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

export async function scheduleOrResetUnsentPoller(
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

export async function queueNotificationDispatchCompletion(
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

export async function queueNotificationDispatchHeartbeat(
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

export async function scheduleRetry(
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

export async function claimPendingDispatchForDelivery(
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

export async function enqueueNotificationDispatchEmail(
	ctx: MutationCtx,
	args: EnqueueNotificationDispatchEmailArgs,
): Promise<EnqueueNotificationDispatchEmailResult> {
	const existing = await ctx.db
		.query("sponsorshipEmailDispatches")
		.withIndex("by_idempotency_key", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey),
		)
		.first();
	if (existing) {
		if (existing.status === "pending") {
			await scheduleOrResetUnsentPoller(ctx, 0, true);
		}
		return {
			dispatchId: existing._id,
			status: existing.status,
			error: existing.error,
		};
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
	return {
		dispatchId,
		status: "pending",
	};
}

export async function runUnsentPollSweep(
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
