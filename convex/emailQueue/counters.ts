import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { EmailDispatchStatus, EmailSourceKind } from "./types";
import { dispatchStatuses, staleDispatchThresholdMs } from "./types";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function hourStartMs(ts: number): number {
	return Math.floor(ts / ONE_HOUR_MS) * ONE_HOUR_MS;
}

export async function bumpDispatchCounter(
	ctx: MutationCtx,
	args: {
		sourceKind: EmailSourceKind;
		status: EmailDispatchStatus;
		delta: number;
		now?: number;
	},
): Promise<void> {
	if (!Number.isFinite(args.delta) || args.delta === 0) return;
	const now = args.now ?? Date.now();
	const existing = await ctx.db
		.query("emailDispatchCounters")
		.withIndex("by_source_and_status", (q) =>
			q.eq("sourceKind", args.sourceKind).eq("status", args.status),
		)
		.first();
	if (!existing) {
		await ctx.db.insert("emailDispatchCounters", {
			sourceKind: args.sourceKind,
			status: args.status,
			count: Math.max(0, args.delta),
			updatedAt: now,
		});
		return;
	}
	await ctx.db.patch("emailDispatchCounters", existing._id, {
		count: Math.max(0, existing.count + args.delta),
		updatedAt: now,
	});
}

export async function transitionDispatchStatus(
	ctx: MutationCtx,
	args: {
		dispatch: Pick<Doc<"emailDispatches">, "_id" | "sourceKind" | "status">;
		nextStatus: EmailDispatchStatus;
		now?: number;
	},
): Promise<void> {
	const prevStatus = args.dispatch.status;
	const nextStatus = args.nextStatus;
	if (prevStatus === nextStatus) return;
	const now = args.now ?? Date.now();
	await bumpDispatchCounter(ctx, {
		sourceKind: args.dispatch.sourceKind,
		status: prevStatus,
		delta: -1,
		now,
	});
	await bumpDispatchCounter(ctx, {
		sourceKind: args.dispatch.sourceKind,
		status: nextStatus,
		delta: 1,
		now,
	});
}

export async function bumpDeadLetterHourly(
	ctx: MutationCtx,
	args: { at: number; delta: number; now?: number },
): Promise<void> {
	if (!Number.isFinite(args.delta) || args.delta === 0) return;
	const now = args.now ?? Date.now();
	const bucket = hourStartMs(args.at);
	const existing = await ctx.db
		.query("emailDeadLetterHourlyCounts")
		.withIndex("by_hour_start", (q) => q.eq("hourStart", bucket))
		.first();
	if (!existing) {
		await ctx.db.insert("emailDeadLetterHourlyCounts", {
			hourStart: bucket,
			count: Math.max(0, args.delta),
			updatedAt: now,
		});
		return;
	}
	await ctx.db.patch("emailDeadLetterHourlyCounts", existing._id, {
		count: Math.max(0, existing.count + args.delta),
		updatedAt: now,
	});
}

export async function getDispatchTotalsFromCounters(ctx: QueryCtx): Promise<{
	bySourceStatus: Record<EmailSourceKind, Record<EmailDispatchStatus, number>>;
	totals: Record<EmailDispatchStatus, number>;
}> {
	const rows = await ctx.db.query("emailDispatchCounters").take(200);
	const bySourceStatus = {
		sponsorship: Object.fromEntries(dispatchStatuses.map((s) => [s, 0])) as Record<
			EmailDispatchStatus,
			number
		>,
		notification: Object.fromEntries(dispatchStatuses.map((s) => [s, 0])) as Record<
			EmailDispatchStatus,
			number
		>,
		sponsor_auth: Object.fromEntries(dispatchStatuses.map((s) => [s, 0])) as Record<
			EmailDispatchStatus,
			number
		>,
	} satisfies Record<EmailSourceKind, Record<EmailDispatchStatus, number>>;

	const totals = Object.fromEntries(dispatchStatuses.map((s) => [s, 0])) as Record<
		EmailDispatchStatus,
		number
	>;

	for (const row of rows) {
		bySourceStatus[row.sourceKind][row.status] =
			(bySourceStatus[row.sourceKind][row.status] ?? 0) + row.count;
		totals[row.status] = (totals[row.status] ?? 0) + row.count;
	}

	return { bySourceStatus, totals };
}

export async function getDeadLettersLast24h(ctx: QueryCtx, now: number): Promise<number> {
	const cutoff = now - ONE_DAY_MS;
	// Read a small bounded set of buckets; worst-case < 48 for small skew.
	const buckets = await ctx.db
		.query("emailDeadLetterHourlyCounts")
		.withIndex("by_hour_start", (q) => q.gte("hourStart", hourStartMs(cutoff)))
		.order("asc")
		.take(80);
	let sum = 0;
	for (const b of buckets) {
		// Keep only buckets overlapping the true window.
		if (b.hourStart + ONE_HOUR_MS > cutoff && b.hourStart <= now) {
			sum += b.count;
		}
	}
	return sum;
}

export async function getStaleQueuedCountBounded(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	// Exact stale counts require scanning all queued rows. For health UI, a bounded
	// upper limit keeps query cost predictable.
	const cutoff = now - staleDispatchThresholdMs;
	const stale = await ctx.db
		.query("emailDispatches")
		.withIndex("by_status_updated_at", (q) => q.eq("status", "queued").lt("updatedAt", cutoff))
		.take(5000);
	return stale.length;
}

