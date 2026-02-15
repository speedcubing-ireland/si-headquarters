import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toISO } from "../lib/transforms";
import { type dispatchStatuses, staleDispatchThresholdMs } from "./types";

const sourceKinds = ["sponsorship", "notification", "sponsor_auth"] as const;
const PAGE_SIZE = 256;

async function countQueryRows<T>(args: {
	queryFactory: (
		cursor: string | null,
	) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>;
	predicate?: (row: T) => boolean;
}): Promise<number> {
	let cursor: string | null = null;
	let count = 0;
	while (true) {
		const page = await args.queryFactory(cursor);
		if (args.predicate) {
			count += page.page.filter(args.predicate).length;
		} else {
			count += page.page.length;
		}
		if (page.isDone) {
			return count;
		}
		cursor = page.continueCursor;
	}
}

async function countDispatchesBySourceAndStatus(args: {
	ctx: QueryCtx;
	sourceKind: (typeof sourceKinds)[number];
	status: (typeof dispatchStatuses)[number];
}): Promise<number> {
	return countQueryRows({
		queryFactory: (cursor) =>
			args.ctx.db
				.query("emailDispatches")
				.withIndex("by_source_status_created_at", (q) =>
					q.eq("sourceKind", args.sourceKind).eq("status", args.status),
				)
				.paginate({ cursor, numItems: PAGE_SIZE }),
	});
}

async function countStaleQueuedDispatches(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	return countQueryRows({
		queryFactory: (cursor) =>
			ctx.db
				.query("emailDispatches")
				.withIndex("by_status_updated_at", (q) => q.eq("status", "queued"))
				.paginate({ cursor, numItems: PAGE_SIZE }),
		predicate: (dispatch) =>
			dispatch.updatedAt + staleDispatchThresholdMs < now,
	});
}

async function countDeadLettersLast24h(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	return countQueryRows({
		queryFactory: (cursor) =>
			ctx.db
				.query("emailDeadLetters")
				.withIndex("by_failed_at", (q) =>
					q.gte("failedAt", now - 24 * 60 * 60 * 1000),
				)
				.paginate({ cursor, numItems: PAGE_SIZE }),
	});
}

export async function getDispatchHealth(ctx: QueryCtx): Promise<{
	totals: {
		queued: number;
		sending: number;
		awaitingProvider: number;
		sent: number;
		deadLetter: number;
		canceled: number;
	};
	bySource: Array<{
		sourceKind: "sponsorship" | "notification" | "sponsor_auth";
		queued: number;
		sending: number;
		awaitingProvider: number;
		sent: number;
		deadLetter: number;
		canceled: number;
	}>;
	staleQueuedCount: number;
	deadLettersLast24h: number;
}> {
	const now = Date.now();
	const totals = {
		queued: 0,
		sending: 0,
		awaitingProvider: 0,
		sent: 0,
		deadLetter: 0,
		canceled: 0,
	};

	const bySourceMap = new Map<
		"sponsorship" | "notification" | "sponsor_auth",
		typeof totals
	>();
	for (const sourceKind of sourceKinds) {
		bySourceMap.set(sourceKind, {
			queued: 0,
			sending: 0,
			awaitingProvider: 0,
			sent: 0,
			deadLetter: 0,
			canceled: 0,
		});
	}

	for (const sourceKind of sourceKinds) {
		const source = bySourceMap.get(sourceKind);
		if (!source) {
			continue;
		}
		const [queued, sending, awaitingProvider, sent, deadLetter, canceled] =
			await Promise.all([
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "queued",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "sending",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "awaiting_provider",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "sent",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "dead_letter",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "canceled",
				}),
			]);
		source.queued = queued;
		source.sending = sending;
		source.awaitingProvider = awaitingProvider;
		source.sent = sent;
		source.deadLetter = deadLetter;
		source.canceled = canceled;

		totals.queued += queued;
		totals.sending += sending;
		totals.awaitingProvider += awaitingProvider;
		totals.sent += sent;
		totals.deadLetter += deadLetter;
		totals.canceled += canceled;
	}

	const [staleQueuedCount, deadLettersLast24h] = await Promise.all([
		countStaleQueuedDispatches(ctx, now),
		countDeadLettersLast24h(ctx, now),
	]);

	return {
		totals,
		bySource: sourceKinds.map((sourceKind) => ({
			sourceKind,
			...(bySourceMap.get(sourceKind) ?? {
				queued: 0,
				sending: 0,
				awaitingProvider: 0,
				sent: 0,
				deadLetter: 0,
				canceled: 0,
			}),
		})),
		staleQueuedCount,
		deadLettersLast24h,
	};
}

export async function listRecentDeadLetters(
	ctx: QueryCtx,
	args?: {
		limit?: number;
		sourceKind?: "sponsorship" | "notification" | "sponsor_auth";
	},
): Promise<
	Array<{
		id: Id<"emailDeadLetters">;
		dispatchId: Id<"emailDispatches">;
		sourceKind: "sponsorship" | "notification" | "sponsor_auth";
		sourceRef?: string;
		templateKey: string;
		recipientEmail: string;
		subject: string;
		error: string;
		sendAttemptCount: number;
		pollAttemptCount: number;
		replayCount: number;
		failedAt: string;
	}>
> {
	const limit = args?.limit ? Math.max(1, Math.min(args.limit, 100)) : 20;
	const sourceKind = args?.sourceKind;

	const rows = sourceKind
		? await ctx.db
				.query("emailDeadLetters")
				.withIndex("by_source_and_failed_at", (q) =>
					q.eq("sourceKind", sourceKind),
				)
				.order("desc")
				.take(limit)
		: await ctx.db
				.query("emailDeadLetters")
				.withIndex("by_failed_at")
				.order("desc")
				.take(limit);

	return rows.map((row) => ({
		id: row._id,
		dispatchId: row.dispatchId,
		sourceKind: row.sourceKind,
		sourceRef: row.sourceRef,
		templateKey: row.templateKey,
		recipientEmail: row.recipientEmail,
		subject: row.subject,
		error: row.error,
		sendAttemptCount: row.sendAttemptCount,
		pollAttemptCount: row.pollAttemptCount,
		replayCount: row.replayCount,
		failedAt: toISO(row.failedAt),
	}));
}

export function mapStatusesForLegacyStats(
	status: (typeof dispatchStatuses)[number],
): "pending" | "sent" | "skipped" | "failed" {
	switch (status) {
		case "sent":
			return "sent";
		case "dead_letter":
			return "failed";
		case "canceled":
			return "skipped";
		case "queued":
		case "sending":
		case "awaiting_provider":
			return "pending";
	}
}
