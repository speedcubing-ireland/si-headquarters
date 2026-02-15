import { v } from "convex/values";

export const emailSourceKind = v.union(
	v.literal("sponsorship"),
	v.literal("notification"),
	v.literal("sponsor_auth"),
);

export const emailDispatchStatus = v.union(
	v.literal("queued"),
	v.literal("sending"),
	v.literal("awaiting_provider"),
	v.literal("sent"),
	v.literal("dead_letter"),
	v.literal("canceled"),
);

export const stageDigestMode = v.union(
	v.literal("immediate"),
	v.literal("hourly"),
	v.literal("daily"),
	v.literal("three_daily"),
);

export const stageStatus = v.union(
	v.literal("pending"),
	v.literal("composed"),
	v.literal("skipped"),
);

export const dispatchStatuses = [
	"queued",
	"sending",
	"awaiting_provider",
	"sent",
	"dead_letter",
	"canceled",
] as const;

export const staleDispatchThresholdMs = 10 * 60 * 1000;

export const emailDispatchStatsReturns = v.object({
	queued: v.number(),
	sending: v.number(),
	awaitingProvider: v.number(),
	sent: v.number(),
	deadLetter: v.number(),
	canceled: v.number(),
});

export const emailDispatchHealthBySourceReturns = v.object({
	sourceKind: emailSourceKind,
	queued: v.number(),
	sending: v.number(),
	awaitingProvider: v.number(),
	sent: v.number(),
	deadLetter: v.number(),
	canceled: v.number(),
});

export const emailDispatchHealthReturns = v.object({
	totals: emailDispatchStatsReturns,
	bySource: v.array(emailDispatchHealthBySourceReturns),
	staleQueuedCount: v.number(),
	deadLettersLast24h: v.number(),
});

export const emailDeadLetterRecordReturns = v.object({
	id: v.id("emailDeadLetters"),
	dispatchId: v.id("emailDispatches"),
	sourceKind: emailSourceKind,
	sourceRef: v.optional(v.string()),
	templateKey: v.string(),
	recipientEmail: v.string(),
	subject: v.string(),
	error: v.string(),
	sendAttemptCount: v.number(),
	pollAttemptCount: v.number(),
	replayCount: v.number(),
	failedAt: v.string(),
});

export type EmailDispatchStatus =
	| "queued"
	| "sending"
	| "awaiting_provider"
	| "sent"
	| "dead_letter"
	| "canceled";

export type EmailSourceKind = "sponsorship" | "notification" | "sponsor_auth";
export type StageDigestMode = "immediate" | "hourly" | "daily" | "three_daily";
