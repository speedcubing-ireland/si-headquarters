import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { STALE_DISPATCH_THRESHOLD_MS } from "../lib/notificationEmail";
import type { NotificationChannel } from "../lib/notificationTypes";
import { toISO } from "../../lib/transforms";

const ALL_NOTIFICATION_CHANNELS: NotificationChannel[] = [
	"in_app",
	"email",
	"slack",
	"push",
];

const DISPATCH_STATUSES = ["pending", "sent", "skipped", "failed"] as const;

type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

type DispatchStatusCounts = Record<DispatchStatus, number>;

type ChannelDispatchStatusCounts = DispatchStatusCounts & {
	channel: NotificationChannel;
};

type DispatchHealthDiagnostics = {
	totals: DispatchStatusCounts;
	byChannel: ChannelDispatchStatusCounts[];
	stalePendingCount: number;
	deadLettersLast24h: number;
};

type DeadLetterDiagnosticsEntry = {
	id: Doc<"notificationDeadLetters">["_id"];
	dispatchId: Doc<"notificationDeadLetters">["dispatchId"];
	eventId: Doc<"notificationDeadLetters">["eventId"];
	userId: Doc<"notificationDeadLetters">["userId"];
	userName?: string;
	userEmail?: string;
	channel: Doc<"notificationDeadLetters">["channel"];
	error: string;
	attempts: number;
	eventType?: Doc<"notificationEvents">["type"];
	entityType?: Doc<"notificationEvents">["entityType"];
	entityId?: Doc<"notificationEvents">["entityId"];
	failedAt: string;
};

const DEAD_LETTER_DEFAULT_LIMIT = 20;
const DEAD_LETTER_MAX_LIMIT = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function emptyDispatchCounts(): DispatchStatusCounts {
	return {
		pending: 0,
		sent: 0,
		skipped: 0,
		failed: 0,
	};
}

function normalizeDeadLetterLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return DEAD_LETTER_DEFAULT_LIMIT;
	}
	return Math.max(1, Math.min(DEAD_LETTER_MAX_LIMIT, Math.floor(limit)));
}

async function countDispatchesByChannelAndStatus(
	ctx: QueryCtx,
	channel: NotificationChannel,
	status: DispatchStatus,
): Promise<number> {
	const dispatches = await ctx.db
		.query("notificationDispatches")
		.withIndex("by_channel_status", (q) =>
			q.eq("channel", channel).eq("status", status),
		)
		.collect();
	return dispatches.length;
}

async function countStalePendingDispatches(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	let staleCount = 0;
	for (const channel of ALL_NOTIFICATION_CHANNELS) {
		const pendingDispatches = await ctx.db
			.query("notificationDispatches")
			.withIndex("by_channel_status", (q) =>
				q.eq("channel", channel).eq("status", "pending"),
			)
			.collect();
		staleCount += pendingDispatches.filter(
			(dispatch) =>
				dispatch.scheduledFor !== undefined &&
				dispatch.scheduledFor + STALE_DISPATCH_THRESHOLD_MS < now,
		).length;
	}
	return staleCount;
}

async function countDeadLettersLast24h(
	ctx: QueryCtx,
	now: number,
): Promise<number> {
	const deadLetters = await ctx.db
		.query("notificationDeadLetters")
		.withIndex("by_failed_at", (q) => q.gte("failedAt", now - ONE_DAY_MS))
		.collect();
	return deadLetters.length;
}

export async function getDispatchHealthDiagnostics(
	ctx: QueryCtx,
): Promise<DispatchHealthDiagnostics> {
	const now = Date.now();

	const byChannel = await Promise.all(
		ALL_NOTIFICATION_CHANNELS.map(async (channel) => {
			const counts = await Promise.all(
				DISPATCH_STATUSES.map((status) =>
					countDispatchesByChannelAndStatus(ctx, channel, status),
				),
			);
			const statusCounts = Object.fromEntries(
				DISPATCH_STATUSES.map((status, index) => [status, counts[index]]),
			) as DispatchStatusCounts;
			return {
				channel,
				...statusCounts,
			};
		}),
	);

	const totals = byChannel.reduce<DispatchStatusCounts>((acc, counts) => {
		for (const status of DISPATCH_STATUSES) {
			acc[status] += counts[status];
		}
		return acc;
	}, emptyDispatchCounts());

	const [stalePendingCount, deadLettersLast24h] = await Promise.all([
		countStalePendingDispatches(ctx, now),
		countDeadLettersLast24h(ctx, now),
	]);

	return {
		totals,
		byChannel,
		stalePendingCount,
		deadLettersLast24h,
	};
}

export async function listRecentDeadLettersDiagnostics(
	ctx: QueryCtx,
	args: {
		limit?: number;
		channel?: NotificationChannel;
	},
): Promise<DeadLetterDiagnosticsEntry[]> {
	const limit = normalizeDeadLetterLimit(args.limit);
	const deadLetters =
		args.channel === undefined
			? await ctx.db
					.query("notificationDeadLetters")
					.withIndex("by_failed_at")
					.order("desc")
					.take(limit)
			: await ctx.db
					.query("notificationDeadLetters")
					.withIndex("by_channel_failed_at", (q) =>
						q.eq("channel", args.channel as NotificationChannel),
					)
					.order("desc")
					.take(limit);

	return Promise.all(
		deadLetters.map(async (deadLetter) => {
			const [user, event] = await Promise.all([
				ctx.db.get("users", deadLetter.userId),
				ctx.db.get("notificationEvents", deadLetter.eventId),
			]);
			return {
				id: deadLetter._id,
				dispatchId: deadLetter.dispatchId,
				eventId: deadLetter.eventId,
				userId: deadLetter.userId,
				userName: user?.name,
				userEmail: user?.email,
				channel: deadLetter.channel,
				error: deadLetter.error,
				attempts: deadLetter.attempts,
				eventType: event?.type,
				entityType: event?.entityType,
				entityId: event?.entityId,
				failedAt: toISO(deadLetter.failedAt),
			};
		}),
	);
}
