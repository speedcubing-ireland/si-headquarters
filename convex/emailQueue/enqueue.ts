import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { buildDeterministicEmailOperationId } from "../lib/email";
import { normalizeEmail } from "../lib/sanitize";
import type { EmailDispatchStatus, EmailSourceKind } from "./types";
import { emailSendPool } from "./pool";
import { bumpDispatchCounter } from "./counters";

export const DEFAULT_EMAIL_DELAY_MS = 0;
const ACS_DEFAULT_SEND_INTERVAL_MS = 36_000;
const PACE_STATUSES: EmailDispatchStatus[] = [
	"queued",
	"sending",
	"submitted",
	"sent",
	"delivered",
	"suppressed",
	"bounced",
	"quarantined",
	"filtered_spam",
	"failed_delivery",
	"awaiting_provider",
	"dead_letter",
	"canceled",
];

export type EnqueueEmailDispatchArgs = {
	dedupeKey: string;
	sourceKind: EmailSourceKind;
	sourceRef?: string;
	templateKey: string;
	recipientEmail: string;
	recipientName?: string;
	senderAddress?: string;
	subject: string;
	htmlBody?: string;
	plainTextBody: string;
	payloadJson?: string;
	scheduledFor?: number;
	forceResend?: boolean;
	replaySuffix?: string;
};

export type EnqueueEmailDispatchResult = {
	dispatchId: Id<"emailDispatches">;
	dedupeKey: string;
	status: EmailDispatchStatus;
	created: boolean;
};

function normalizeDedupeKey(dedupeKey: string): string {
	const trimmed = dedupeKey.trim();
	if (!trimmed) {
		throw new Error("dedupe_key_required");
	}
	return trimmed;
}

function buildReplayDedupeKey(
	dedupeKey: string,
	replaySuffix?: string,
): string {
	if (replaySuffix) {
		return `${dedupeKey}|${replaySuffix}`;
	}
	return `${dedupeKey}|replay:${Date.now()}`;
}

async function scheduleSendDispatch(
	ctx: MutationCtx,
	args: {
		dispatchId: Id<"emailDispatches">;
		claimKey: string;
		scheduledFor: number;
	},
): Promise<void> {
	await emailSendPool.enqueueAction(
		ctx,
		internal.emailQueue._sendDispatch,
		{
			dispatchId: args.dispatchId,
			claimKey: args.claimKey,
		},
		{
			runAt: args.scheduledFor,
			retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
		},
	);
}

function getEmailSendIntervalMs(): number {
	const raw = process.env.EMAIL_SEND_INTERVAL_MS?.trim();
	if (!raw) return ACS_DEFAULT_SEND_INTERVAL_MS;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed >= 0
		? Math.min(parsed, 60 * 60 * 1000)
		: ACS_DEFAULT_SEND_INTERVAL_MS;
}

async function getNextPacedScheduledFor(
	ctx: MutationCtx,
	requestedFor: number,
): Promise<number> {
	const latestRows = await Promise.all(
		PACE_STATUSES.map((status) =>
			ctx.db
				.query("emailDispatches")
				.withIndex("by_status_scheduled_for", (q) => q.eq("status", status))
				.order("desc")
				.first(),
		),
	);
	const latestScheduledFor = latestRows.reduce<number | null>(
		(latest, row) =>
			row && (latest === null || row.scheduledFor > latest)
				? row.scheduledFor
				: latest,
		null,
	);
	const intervalMs = getEmailSendIntervalMs();
	const earliestFromQueue = latestScheduledFor
		? latestScheduledFor + intervalMs
		: requestedFor;
	return Math.max(requestedFor, earliestFromQueue);
}

/** Ensures a queued row has a claimKey and nudges the send action (e.g. duplicate enqueue). */
async function kickQueuedDispatch(
	ctx: MutationCtx,
	existing: {
		_id: Id<"emailDispatches">;
		claimKey?: string;
		scheduledFor: number;
	},
): Promise<void> {
	const now = Date.now();
	let claimKey = existing.claimKey;
	if (!claimKey) {
		claimKey = `${existing._id}:${now}`;
		await ctx.db.patch("emailDispatches", existing._id, {
			claimKey,
			updatedAt: now,
		});
	}
	await scheduleSendDispatch(ctx, {
		dispatchId: existing._id,
		claimKey,
		scheduledFor: Math.max(existing.scheduledFor, now),
	});
}

export async function enqueueDispatch(
	ctx: MutationCtx,
	args: EnqueueEmailDispatchArgs,
): Promise<EnqueueEmailDispatchResult> {
	const dedupeKeyBase = normalizeDedupeKey(args.dedupeKey);
	const dedupeKey = args.forceResend
		? buildReplayDedupeKey(dedupeKeyBase, args.replaySuffix)
		: dedupeKeyBase;

	if (!args.forceResend) {
		const existing = await ctx.db
			.query("emailDispatches")
			.withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
			.first();
		if (existing) {
			if (existing.status === "queued") {
				await kickQueuedDispatch(ctx, existing);
			}
			return {
				dispatchId: existing._id,
				dedupeKey: existing.dedupeKey,
				status: existing.status,
				created: false,
			};
		}
	}

	const now = Date.now();
	const recipientEmail =
		normalizeEmail(args.recipientEmail) ?? args.recipientEmail;
	const requestedScheduledFor = args.scheduledFor ?? now + DEFAULT_EMAIL_DELAY_MS;
	const scheduledFor = await getNextPacedScheduledFor(
		ctx,
		Math.max(requestedScheduledFor, now),
	);
	const providerOperationId = buildDeterministicEmailOperationId(dedupeKey);

	const dispatchId = await ctx.db.insert("emailDispatches", {
		dedupeKey,
		sourceKind: args.sourceKind,
		sourceRef: args.sourceRef,
		templateKey: args.templateKey,
		recipientEmail,
		recipientName: args.recipientName,
		senderAddress: args.senderAddress,
		subject: args.subject,
		htmlBody: args.htmlBody,
		plainTextBody: args.plainTextBody,
		payloadJson: args.payloadJson,
		scheduledFor,
		status: "queued",
		claimKey: undefined,
		providerOperationId,
		providerOperationClaimKey: undefined,
		providerStatus: undefined,
		providerPollerState: undefined,
		sendAttemptCount: 0,
		pollAttemptCount: 0,
		lastProviderCheckAt: undefined,
		submittedAt: undefined,
		deliveredAt: undefined,
		sentAt: undefined,
		error: undefined,
		deadLetteredAt: undefined,
		createdAt: now,
		updatedAt: now,
	});

	await bumpDispatchCounter(ctx, {
		sourceKind: args.sourceKind,
		status: "queued",
		delta: 1,
		now,
	});

	const claimKey = `${dispatchId}:${Date.now()}`;
	await ctx.db.patch("emailDispatches", dispatchId, {
		claimKey,
		updatedAt: Date.now(),
	});

	await scheduleSendDispatch(ctx, {
		dispatchId,
		claimKey,
		scheduledFor: Math.max(scheduledFor, now),
	});

	return {
		dispatchId,
		dedupeKey,
		status: "queued",
		created: true,
	};
}
