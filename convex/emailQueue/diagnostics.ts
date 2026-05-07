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
		submitted: number;
		delivered: number;
		suppressed: number;
		bounced: number;
		quarantined: number;
		filteredSpam: number;
		failedDelivery: number;
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
		submitted: 0,
		delivered: 0,
		suppressed: 0,
		bounced: 0,
		quarantined: 0,
		filteredSpam: 0,
		failedDelivery: 0,
		deadLetter: 0,
		canceled: 0,
	};

	for (const sourceKind of sourceKinds) {
		const [
			queued,
			sending,
			submitted,
			delivered,
			suppressed,
			bounced,
			quarantined,
			filteredSpam,
			failedDelivery,
			deadLetter,
			canceled,
		] =
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
					status: "submitted",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "delivered",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "suppressed",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "bounced",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "quarantined",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "filtered_spam",
				}),
				countDispatchesBySourceAndStatus({
					ctx,
					sourceKind,
					status: "failed_delivery",
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
		totals.submitted += submitted;
		totals.delivered += delivered;
		totals.suppressed += suppressed;
		totals.bounced += bounced;
		totals.quarantined += quarantined;
		totals.filteredSpam += filteredSpam;
		totals.failedDelivery += failedDelivery;
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

function percentile(sorted: number[], p: number): number | null {
	if (sorted.length === 0) return null;
	const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
	return sorted[idx] ?? null;
}

export async function getDeliveryDiagnostics(ctx: QueryCtx, args?: { sampleSize?: number }) {
	const sampleSize = args?.sampleSize ? Math.max(10, Math.min(args.sampleSize, 500)) : 200;
	const delivered = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_updated_at", (q) => q.eq("status", "delivered"))
		.order("desc")
		.take(sampleSize);

	const latenciesMs = delivered
		.flatMap((d) =>
			typeof d.submittedAt === "number" && typeof d.deliveredAt === "number"
				? [d.deliveredAt - d.submittedAt]
				: [],
		)
		.filter((n) => Number.isFinite(n) && n >= 0)
		.sort((a, b) => a - b);

	return {
		sampleSize: delivered.length,
		latencyMs: {
			p50: percentile(latenciesMs, 0.5),
			p95: percentile(latenciesMs, 0.95),
		},
	};
}

export function mapStatusesForLegacyStats(
	status: (typeof dispatchStatuses)[number],
): "pending" | "sent" | "skipped" | "failed" {
	switch (status) {
		case "sent":
			return "sent";
		case "delivered":
			return "sent";
		case "dead_letter":
			return "failed";
		case "canceled":
			return "skipped";
		case "suppressed":
		case "bounced":
		case "quarantined":
		case "filtered_spam":
		case "failed_delivery":
			return "failed";
		case "queued":
		case "sending":
		case "submitted":
		case "awaiting_provider":
			return "pending";
	}
}
