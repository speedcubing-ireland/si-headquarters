import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toISO } from "../lib/transforms";
import { type dispatchStatuses, staleDispatchThresholdMs } from "./types";

const sourceKinds = ["sponsorship", "notification", "sponsor_auth"] as const;

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
	const allDispatches = await ctx.db.query("emailDispatches").collect();
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

	for (const dispatch of allDispatches) {
		switch (dispatch.status) {
			case "queued":
				totals.queued += 1;
				break;
			case "sending":
				totals.sending += 1;
				break;
			case "awaiting_provider":
				totals.awaitingProvider += 1;
				break;
			case "sent":
				totals.sent += 1;
				break;
			case "dead_letter":
				totals.deadLetter += 1;
				break;
			case "canceled":
				totals.canceled += 1;
				break;
		}

		const source = bySourceMap.get(dispatch.sourceKind);
		if (!source) continue;
		switch (dispatch.status) {
			case "queued":
				source.queued += 1;
				break;
			case "sending":
				source.sending += 1;
				break;
			case "awaiting_provider":
				source.awaitingProvider += 1;
				break;
			case "sent":
				source.sent += 1;
				break;
			case "dead_letter":
				source.deadLetter += 1;
				break;
			case "canceled":
				source.canceled += 1;
				break;
		}
	}

	const staleQueuedCount = allDispatches.filter(
		(dispatch) =>
			dispatch.status === "queued" &&
			dispatch.updatedAt + staleDispatchThresholdMs < now,
	).length;

	const deadLetters = await ctx.db
		.query("emailDeadLetters")
		.withIndex("by_failed_at", (q) =>
			q.gte("failedAt", now - 24 * 60 * 60 * 1000),
		)
		.collect();

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
		deadLettersLast24h: deadLetters.length,
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
