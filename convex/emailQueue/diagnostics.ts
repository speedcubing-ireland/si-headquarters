import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toISO } from "../lib/transforms";
import type { EmailDispatchStatus } from "./types";
import {
	getDeadLettersLast24h,
	getDispatchTotalsFromCounters,
	getStaleQueuedCountBounded,
} from "./counters";

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
		sent: number;
		deadLetter: number;
		canceled: number;
	};
	staleQueuedCount: number;
	deadLettersLast24h: number;
}> {
	const now = Date.now();
	const [{ totals: totalsByStatus }, staleQueuedCount, deadLettersLast24h] =
		await Promise.all([
			getDispatchTotalsFromCounters(ctx),
			getStaleQueuedCountBounded(ctx, now),
			getDeadLettersLast24h(ctx, now),
		]);

	const totals = {
		queued: totalsByStatus.queued,
		sending: totalsByStatus.sending,
		submitted: totalsByStatus.submitted,
		delivered: totalsByStatus.delivered,
		suppressed: totalsByStatus.suppressed,
		bounced: totalsByStatus.bounced,
		quarantined: totalsByStatus.quarantined,
		filteredSpam: totalsByStatus.filtered_spam,
		failedDelivery: totalsByStatus.failed_delivery,
		sent: totalsByStatus.sent,
		deadLetter: totalsByStatus.dead_letter,
		canceled: totalsByStatus.canceled,
	};

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
	status: EmailDispatchStatus,
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
