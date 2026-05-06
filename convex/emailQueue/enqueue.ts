import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { buildDeterministicEmailOperationId } from "../lib/email";
import { normalizeEmail } from "../lib/sanitize";
import type { EmailSourceKind } from "./types";

export const DEFAULT_EMAIL_DELAY_MS = 0;

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
	status:
		| "queued"
		| "sent"
		| "dead_letter"
		| "sending"
		| "awaiting_provider"
		| "canceled";
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
	await ctx.scheduler.runAt(
		args.scheduledFor,
		internal.emailQueue._sendDispatch,
		{
			dispatchId: args.dispatchId,
			claimKey: args.claimKey,
		},
	);
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
	const scheduledFor = args.scheduledFor ?? now + DEFAULT_EMAIL_DELAY_MS;
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
		providerStatus: undefined,
		providerPollerState: undefined,
		sendAttemptCount: 0,
		pollAttemptCount: 0,
		lastProviderCheckAt: undefined,
		sentAt: undefined,
		error: undefined,
		deadLetteredAt: undefined,
		createdAt: now,
		updatedAt: now,
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
