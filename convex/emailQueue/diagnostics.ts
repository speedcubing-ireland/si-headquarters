import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toISO } from "../lib/transforms";
import { type dispatchStatuses, staleDispatchThresholdMs } from "./types";

const sourceKinds = ["sponsorship", "notification", "sponsor_auth"] as const;
const PAGE_SIZE = 256;

async function countWithTake<T>(args: {
	runPage: (cursor: number | null) => Promise<T[]>;
	getCursor: (doc: T) => number;
	predicate?: (row: T) => boolean;
}): Promise<number> {
	let cursor: number | null = null;
	let count = 0;
	while (true) {
		const page = await args.runPage(cursor);
		count += args.predicate ? page.filter(args.predicate).length : page.length;
		if (page.length < PAGE_SIZE) return count;
		const last = page[page.length - 1];
		if (!last) return count;
		cursor = args.getCursor(last);
	}
}

async function countDispatchesBySourceAndStatus(args: {
	ctx: QueryCtx;
	sourceKind: (typeof sourceKinds)[number];
	status: (typeof dispatchStatuses)[number];
}): Promise<number> {
	const { ctx, sourceKind, status } = args;
	return countWithTake({
		runPage: (cursor) =>
			ctx.db
				.query("emailDispatches")
				.withIndex("by_source_status_created_at", (q) =>
					cursor === null
						? q.eq("sourceKind", sourceKind).eq("status", status)
						: q
								.eq("sourceKind", sourceKind)
								.eq("status", status)
								.gt("createdAt", cursor),
				)
				.order("asc")
				.take(PAGE_SIZE),
		getCursor: (doc) => doc.createdAt,
	});
}

async function countStaleQueuedDispatches(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	return countWithTake({
		runPage: (cursor) =>
			ctx.db
				.query("emailDispatches")
				.withIndex("by_status_updated_at", (q) =>
					cursor === null
						? q.eq("status", "queued")
						: q.eq("status", "queued").gt("updatedAt", cursor),
				)
				.order("asc")
				.take(PAGE_SIZE),
		getCursor: (doc) => doc.updatedAt,
		predicate: (dispatch) =>
			dispatch.updatedAt + staleDispatchThresholdMs < now,
	});
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function countDeadLettersLast24h(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	const cutoff = now - ONE_DAY_MS;
	return countWithTake({
		runPage: (cursor) =>
			ctx.db
				.query("emailDeadLetters")
				.withIndex("by_failed_at", (q) =>
					cursor === null
						? q.gte("failedAt", cutoff)
						: q.gt("failedAt", cursor),
				)
				.order("asc")
				.take(PAGE_SIZE),
		getCursor: (doc) => doc.failedAt,
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

	for (const sourceKind of sourceKinds) {
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
