import { ConvexError, v } from "convex/values";
import {
	mutation,
	query,
	internalMutation,
	internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./auth";
import { requireDirector } from "./admin";
import { getCommentParentId } from "./lib/commentParentId";
import {
	notificationChannel,
	notificationDigestMode,
	notificationType,
} from "./notifications/lib/validators";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType,
} from "./notifications/lib/notificationTemplates";
import { toISO } from "./lib/transforms";
import { normalizeEmail, validateEmail } from "./lib/sanitize";
import {
	EMAIL_CHANNEL,
	notificationReturns,
	notificationPreferenceReturns,
	notificationUserSettingsReturns,
	notificationSettingsReturns,
	notificationSubscriptionReturns,
	notificationDispatchStatsReturns,
	notificationDispatchHealthReturns,
	notificationDeadLetterReturns,
	entitySubscriptionArgs,
	type NotificationChannel,
	type NotificationType,
	type NotificationEntityType,
	type EntitySubscriptionArg,
	type NotificationEntityRef,
	type NotificationEmitInput,
	type EmailDispatchSnapshot,
} from "./notifications/lib/notificationTypes";
import {
	docToNotification,
	normalizeListLimit,
	normalizeSubscriptionListLimit,
	isUnreadNotificationVisible,
	listVisibleNotificationsForUser,
	countVisibleUnreadNotifications,
	parseEmailDispatchSnapshot,
	serializePayload,
	notificationParentEntityId,
	defaultThreadKey,
} from "./notifications/lib/notificationHelpers";
import {
	getNotificationPreferenceConfig,
	getNotificationUserTimezone,
	getResolvedNotificationUserSettings,
	upsertNotificationUserSettings,
	buildPreferenceRowsForUser,
	upsertNotificationPreferenceOverride,
	formatUserSettings,
} from "./notifications/lib/notificationSettings";
import {
	canUserAccessTask,
	canUserAccessCompetition,
	canUserAccessComment,
	canUserAccessNotificationEntity,
} from "./notifications/lib/notificationAccess";
import {
	getActorInfo,
	resolveRecipientIds,
	buildTaskNotificationResult,
	buildCompetitionNotificationResult,
	type TaskNotificationBuildArgs,
	type CompetitionNotificationBuildArgs,
} from "./notifications/lib/notificationBuilders";
import {
	buildNotificationGroupEmailContent,
	buildNotificationGroupIdempotencyKey,
	mapDispatchItemsToEmailGroupItems,
} from "./notifications/lib/emailDispatchComposer";
import { computeDispatchSchedule } from "./notifications/lib/notificationScheduling";
import {
	computeDueDateDaysDiff,
	buildDueDateNotificationSpec,
	MS_PER_DAY,
	type DueDateNotificationSpec,
} from "./notifications/lib/notificationDueDates";
import { buildNotificationEmitInput } from "./notifications/emit";
import { expandRecipientIds } from "./notifications/recipients/expand";
import { decideRecipientHandling } from "./notifications/recipients/filter";
import { computeInAppScheduleForRecipient } from "./notifications/recipients/schedule";
import { enqueueDispatch } from "./emailQueue/enqueue";
import {
	queryEmailDispatchHealth,
	queryRecentEmailDeadLetters,
} from "./emailQueue";
import { sendTestEmailPreview } from "./notifications/lib/emailPreview";

export { notificationReturns } from "./notifications/lib/notificationTypes";

async function ensureNotificationEvent(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entityType: NotificationEntityType;
		entityId: string;
		actorId?: Id<"users">;
		idempotencyKey: string;
		threadKey: string;
		dedupeKey: string;
		payloadJson?: string;
	},
): Promise<Id<"notificationEvents">> {
	const existing = await ctx.db
		.query("notificationEvents")
		.withIndex("by_idempotency_key", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey),
		)
		.first();
	if (existing) {
		return existing._id;
	}

	return ctx.db.insert("notificationEvents", {
		type: args.type,
		entityType: args.entityType,
		entityId: args.entityId,
		actorId: args.actorId,
		idempotencyKey: args.idempotencyKey,
		threadKey: args.threadKey,
		dedupeKey: args.dedupeKey,
		payloadJson: args.payloadJson,
		createdAt: Date.now(),
	});
}

function buildStageKey(
	eventId: Id<"notificationEvents">,
	userId: Id<"users">,
): string {
	return `${eventId}:${userId}`;
}

function isQuietHoursDigestWindowKey(
	digestWindowKey: string | undefined,
): boolean {
	return digestWindowKey?.startsWith("quiet:") ?? false;
}

function resolveStageDigestWindowKey(args: {
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	stageKey: string;
	scheduledDigestWindowKey: string | undefined;
}): string | undefined {
	if (args.digestMode !== "immediate") {
		return args.scheduledDigestWindowKey;
	}
	if (isQuietHoursDigestWindowKey(args.scheduledDigestWindowKey)) {
		return args.scheduledDigestWindowKey;
	}
	return args.stageKey;
}

function buildNotificationGroupSourceRef(args: {
	userId: Id<"users">;
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
}): string {
	return `notification_group:${args.userId}:${args.digestMode}:${args.digestWindowKey ?? "immediate"}`;
}

type NotificationEmailStageGroupArgs = {
	userId: Id<"users">;
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
};

type ScheduledFunctionStateDoc = {
	scheduledTime?: number;
	state?: {
		kind?: string;
	};
};

function normalizeScheduledFunctionState(kind: string | undefined): string {
	return (kind ?? "").toLowerCase().replace(/[_-]/g, "");
}

function isPendingScheduledFunctionState(kind: string | undefined): boolean {
	const normalized = normalizeScheduledFunctionState(kind);
	return normalized === "pending" || normalized === "inprogress";
}

async function findReusableNotificationStageSchedule(
	ctx: MutationCtx,
	pendingRows: Array<
		Doc<"notificationEmailStageItems"> & {
			scheduledFunctionId?: Id<"_scheduled_functions">;
		}
	>,
	targetScheduledFor: number,
): Promise<Id<"_scheduled_functions"> | undefined> {
	const candidateIds = [
		...new Set(
			pendingRows
				.map((row) => row.scheduledFunctionId)
				.filter(
					(
						scheduledFunctionId,
					): scheduledFunctionId is Id<"_scheduled_functions"> =>
						scheduledFunctionId !== undefined,
				),
		),
	];

	for (const scheduledFunctionId of candidateIds) {
		const scheduledDoc = (await ctx.db.system.get(
			"_scheduled_functions",
			scheduledFunctionId,
		)) as ScheduledFunctionStateDoc | null;
		if (!scheduledDoc) {
			continue;
		}
		if (!isPendingScheduledFunctionState(scheduledDoc.state?.kind)) {
			continue;
		}
		if (
			typeof scheduledDoc.scheduledTime === "number" &&
			scheduledDoc.scheduledTime <= targetScheduledFor
		) {
			return scheduledFunctionId;
		}
	}

	return undefined;
}

async function ensureNotificationEmailStageGroupScheduled(
	ctx: MutationCtx,
	args: NotificationEmailStageGroupArgs,
): Promise<void> {
	const pendingRows = await ctx.db
		.query("notificationEmailStageItems")
		.withIndex("by_user_mode_window_status", (q) =>
			q
				.eq("userId", args.userId)
				.eq("digestMode", args.digestMode)
				.eq("digestWindowKey", args.digestWindowKey)
				.eq("status", "pending"),
		)
		.collect();
	if (pendingRows.length === 0) {
		return;
	}

	const now = Date.now();
	const targetScheduledFor = pendingRows.reduce(
		(minScheduledFor, row) => Math.min(minScheduledFor, row.scheduledFor),
		Number.POSITIVE_INFINITY,
	);
	const targetRows = pendingRows.filter(
		(row) => row.scheduledFor === targetScheduledFor,
	);

	const composeArgs = {
		userId: args.userId,
		digestMode: args.digestMode,
		digestWindowKey: args.digestWindowKey,
	} as const;

	const reusableScheduledFunctionId =
		await findReusableNotificationStageSchedule(
			ctx,
			targetRows,
			targetScheduledFor,
		);

	const scheduledFunctionId =
		reusableScheduledFunctionId ??
		(targetScheduledFor <= now
			? await ctx.scheduler.runAfter(
					0,
					internal.notifications._composeNotificationEmailStageGroup,
					composeArgs,
				)
			: await ctx.scheduler.runAt(
					targetScheduledFor,
					internal.notifications._composeNotificationEmailStageGroup,
					composeArgs,
				));

	await Promise.all(
		pendingRows.map((row) =>
			row.scheduledFor === targetScheduledFor
				? row.scheduledFunctionId === scheduledFunctionId
					? Promise.resolve()
					: ctx.db.patch("notificationEmailStageItems", row._id, {
							scheduledFunctionId,
							updatedAt: now,
						})
				: row.scheduledFunctionId !== scheduledFunctionId
					? Promise.resolve()
					: ctx.db.patch("notificationEmailStageItems", row._id, {
							scheduledFunctionId: undefined,
							updatedAt: now,
						}),
		),
	);
}

async function scheduleNextPendingNotificationEmailStageGroup(
	ctx: MutationCtx,
	args: NotificationEmailStageGroupArgs,
	previousPendingCount: number,
	dueRowCount: number,
): Promise<void> {
	if (previousPendingCount <= dueRowCount) {
		return;
	}
	await ensureNotificationEmailStageGroupScheduled(ctx, args);
}

async function clearScheduledFunctionForRows(
	ctx: MutationCtx,
	rows: Doc<"notificationEmailStageItems">[],
	patch: {
		status: "skipped" | "composed";
		emailDispatchId?: Id<"emailDispatches">;
	},
	now: number,
): Promise<void> {
	await Promise.all(
		rows.map((row) =>
			ctx.db.patch("notificationEmailStageItems", row._id, {
				...patch,
				scheduledFunctionId: undefined,
				updatedAt: now,
			}),
		),
	);
}

async function queueNotificationEmailStageItem(
	ctx: MutationCtx,
	args: {
		userId: Id<"users">;
		eventId: Id<"notificationEvents">;
		notificationId?: Id<"notifications">;
		type: NotificationType;
		metadataJson: string;
	},
): Promise<void> {
	const preference = await getNotificationPreferenceConfig(
		ctx,
		args.userId,
		args.type,
		EMAIL_CHANNEL,
	);
	if (!preference.enabled) {
		return;
	}

	const stageKey = buildStageKey(args.eventId, args.userId);
	const existing = await ctx.db
		.query("notificationEmailStageItems")
		.withIndex("by_stage_key", (q) => q.eq("stageKey", stageKey))
		.first();
	if (existing) {
		return;
	}

	const now = Date.now();
	const timezone = await getNotificationUserTimezone(ctx, args.userId);
	const schedule = computeDispatchSchedule({
		now,
		timezone,
		digestMode: preference.digestMode,
		quietHoursStartMin: preference.quietHoursStartMin,
		quietHoursEndMin: preference.quietHoursEndMin,
	});
	const stageDigestWindowKey = resolveStageDigestWindowKey({
		digestMode: preference.digestMode,
		stageKey,
		scheduledDigestWindowKey: schedule.digestWindowKey,
	});

	await ctx.db.insert("notificationEmailStageItems", {
		stageKey,
		userId: args.userId,
		notificationId: args.notificationId,
		eventId: args.eventId,
		digestMode: preference.digestMode,
		digestWindowKey: stageDigestWindowKey,
		scheduledFor: schedule.scheduledFor,
		status: "pending",
		emailDispatchId: undefined,
		scheduledFunctionId: undefined,
		metadataJson: args.metadataJson,
		createdAt: now,
		updatedAt: now,
	});

	await ensureNotificationEmailStageGroupScheduled(ctx, {
		userId: args.userId,
		digestMode: preference.digestMode,
		digestWindowKey: stageDigestWindowKey,
	});
}

async function emitInAppNotifications(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<Id<"notifications">[]> {
	const recipients = await expandRecipientIds(ctx, input);
	if (recipients.length === 0) {
		return [];
	}

	const entityId = input.entity.entityId;
	const parentEntityId = notificationParentEntityId(input.entity);
	const threadKey = input.threadKey ?? defaultThreadKey(input.entity);
	const suppressActorRecipient = input.suppressActorRecipient ?? true;
	const emailDispatchMetadataJson = JSON.stringify({
		type: input.type,
		title: input.title,
		message: input.message,
		body: input.body,
		entityType: input.entity.entityType,
		entityId,
		parentEntityId,
		priority: input.priority,
		actorName: input.metadata?.actorName,
	} satisfies EmailDispatchSnapshot);

	const inserted: Id<"notifications">[] = [];

	for (const recipientId of recipients) {
		const idempotencyKey = `${input.idempotencyBase}:${recipientId}`;
		const dedupeKey =
			input.dedupeKey ?? `${input.type}:${threadKey}:${recipientId}`;

		const eventId = await ensureNotificationEvent(ctx, {
			type: input.type,
			entityType: input.entity.entityType,
			entityId,
			actorId: input.actorId,
			idempotencyKey,
			threadKey,
			dedupeKey,
			payloadJson: input.payloadJson,
		});

		const decision = await decideRecipientHandling(ctx, {
			input,
			recipientId,
			eventId,
			entityId,
			suppressActorRecipient,
		});

		if (decision.kind === "existing") {
			await queueNotificationEmailStageItem(ctx, {
				userId: recipientId,
				eventId,
				notificationId: decision.notification._id,
				type: input.type,
				metadataJson: emailDispatchMetadataJson,
			});
			inserted.push(decision.notification._id);
			continue;
		}

		if (decision.kind === "skip") {
			if (decision.skip.externalStatus === "pending") {
				await queueNotificationEmailStageItem(ctx, {
					userId: recipientId,
					eventId,
					type: input.type,
					metadataJson: emailDispatchMetadataJson,
				});
			}
			continue;
		}

		const { inAppPreference } = decision;
		const inAppSchedule = await computeInAppScheduleForRecipient(
			ctx,
			recipientId,
			inAppPreference,
		);

		const notificationId = await ctx.db.insert("notifications", {
			userId: recipientId,
			type: input.type,
			priority: input.priority,
			status: "unread",
			title: input.title,
			message: input.message,
			body: input.body,
			entityType: input.entity.entityType,
			entityId,
			parentEntityId,
			metadata: input.metadata,
			sourceEventId: eventId,
			threadKey,
			dedupeKey,
			readAt: undefined,
			archivedAt: undefined,
			snoozedUntil: undefined,
			scheduledFor: inAppSchedule.scheduledFor,
			isBatchable: input.isBatchable ?? false,
			batchKey: input.batchKey,
		});
		inserted.push(notificationId);

		await queueNotificationEmailStageItem(ctx, {
			userId: recipientId,
			eventId,
			notificationId,
			type: input.type,
			metadataJson: emailDispatchMetadataJson,
		});
	}

	return inserted;
}

async function ensureSubscriptionEntityAccess(
	ctx: MutationCtx,
	userId: Id<"users">,
	entity: EntitySubscriptionArg,
): Promise<void> {
	if (
		!(await canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(entity),
		))
	) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You do not have access to subscribe to this entity",
		});
	}
}

export const listForUser = query({
	args: {
		limit: v.optional(v.number()),
		nowMs: v.optional(v.number()),
	},
	returns: v.array(notificationReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeListLimit(args.limit);
		void args.nowMs;
		const now = Date.now();
		const docs = await listVisibleNotificationsForUser(ctx, userId, now, limit);
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: { nowMs: v.optional(v.number()) },
	returns: v.number(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		void args.nowMs;
		return countVisibleUnreadNotifications(ctx, userId, Date.now());
	},
});

async function getOwnedNotification(
	ctx: MutationCtx,
	notificationId: Id<"notifications">,
): Promise<Doc<"notifications"> | null> {
	const userId = await requireUserId(ctx);
	const doc = await ctx.db.get("notifications", notificationId);
	return doc && doc.userId === userId ? doc : null;
}

const notificationIdArgs = { notificationId: v.id("notifications") } as const;

export const markRead = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc || doc.status !== "unread") return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "read",
			readAt: Date.now(),
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const markArchived = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc) return null;
		const now = Date.now();
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			readAt: doc.readAt ?? now,
			archivedAt: now,
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const markAllRead = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();

		await Promise.all(
			docs
				.filter((doc) => isUnreadNotificationVisible(doc, now))
				.map((doc) =>
					ctx.db.patch("notifications", doc._id, {
						status: "read",
						readAt: now,
						snoozedUntil: undefined,
					}),
				),
		);
		return null;
	},
});

export const snooze = mutation({
	args: { notificationId: v.id("notifications"), snoozedUntil: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc || doc.status === "archived") return null;

		const snoozedMs = new Date(args.snoozedUntil).getTime();
		if (!Number.isFinite(snoozedMs) || snoozedMs <= Date.now()) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "snoozedUntil must be a valid future timestamp",
			});
		}

		await ctx.db.patch("notifications", args.notificationId, {
			status: "unread",
			readAt: undefined,
			archivedAt: undefined,
			snoozedUntil: snoozedMs,
		});
		return null;
	},
});

export const unsnooze = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc) return null;
		await ctx.db.patch("notifications", args.notificationId, {
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const getUserSettings = query({
	args: {},
	returns: notificationUserSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return formatUserSettings(
			await getResolvedNotificationUserSettings(ctx, userId),
		);
	},
});

export const upsertUserSettings = mutation({
	args: {
		timezone: v.optional(v.string()),
		defaultDigestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
		clearQuietHours: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (
			args.timezone === undefined &&
			args.defaultDigestMode === undefined &&
			args.quietHoursStartMin === undefined &&
			args.quietHoursEndMin === undefined &&
			!args.clearQuietHours
		) {
			return null;
		}
		await upsertNotificationUserSettings(ctx, userId, args);
		return null;
	},
});

export const getSettings = query({
	args: {},
	returns: notificationSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		const preferences = await buildPreferenceRowsForUser(
			ctx,
			userId,
			userSettings,
		);
		return { ...formatUserSettings(userSettings), preferences };
	},
});

export const upsertSettings = mutation({
	args: {
		timezone: v.optional(v.string()),
		defaultDigestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
		clearQuietHours: v.optional(v.boolean()),
		preferences: v.optional(
			v.array(
				v.object({
					type: notificationType,
					channel: notificationChannel,
					enabled: v.optional(v.boolean()),
					digestMode: v.optional(notificationDigestMode),
					respectQuietHours: v.optional(v.boolean()),
					clearOverride: v.optional(v.boolean()),
				}),
			),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const { preferences: prefArgs, ...settingsArgs } = args;
		if (Object.values(settingsArgs).some((v) => v !== undefined)) {
			await upsertNotificationUserSettings(ctx, userId, settingsArgs);
		}

		if (!prefArgs || prefArgs.length === 0) {
			return null;
		}

		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		for (const pref of prefArgs) {
			await upsertNotificationPreferenceOverride(ctx, {
				userId,
				...pref,
				defaultDigestMode: userSettings.defaultDigestMode,
			});
		}
		return null;
	},
});

export const listPreferences = query({
	args: {},
	returns: v.array(notificationPreferenceReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return buildPreferenceRowsForUser(ctx, userId);
	},
});

export const upsertPreference = mutation({
	args: {
		type: notificationType,
		channel: notificationChannel,
		enabled: v.optional(v.boolean()),
		digestMode: v.optional(notificationDigestMode),
		respectQuietHours: v.optional(v.boolean()),
		clearOverride: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		await upsertNotificationPreferenceOverride(ctx, {
			userId,
			...args,
			defaultDigestMode: userSettings.defaultDigestMode,
		});
		return null;
	},
});

type SubscriptionPresentation = {
	label: string;
	description?: string;
	isStale: boolean;
};

const stale = (
	label: string,
	description: string,
): SubscriptionPresentation => ({
	label,
	description,
	isStale: true,
});

async function describeEntitySubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityType: string,
	entityId: string,
): Promise<SubscriptionPresentation> {
	if (entityType === "task") {
		const taskId = ctx.db.normalizeId("tasks", entityId);
		if (!taskId) return stale("Deleted task", "Task");
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return stale("Deleted task", "Task");
		if (!(await canUserAccessTask(ctx, userId, taskId)))
			return stale("Restricted task", "Task");
		return {
			label: `${task.identifier}: ${task.title}`,
			description: "Task",
			isStale: false,
		};
	}

	if (entityType === "competition") {
		const compId = ctx.db.normalizeId("competitions", entityId);
		if (!compId) return stale("Deleted competition", "Competition");
		const comp = await ctx.db.get("competitions", compId);
		if (!comp) return stale("Deleted competition", "Competition");
		if (!(await canUserAccessCompetition(ctx, userId, compId)))
			return stale("Restricted competition", "Competition");
		return { label: comp.name, description: "Competition", isStale: false };
	}

	const commentId = ctx.db.normalizeId("comments", entityId);
	if (!commentId) return stale("Deleted comment", "Comment");
	const comment = await ctx.db.get("comments", commentId);
	if (!comment) return stale("Deleted comment", "Comment");
	if (!(await canUserAccessComment(ctx, userId, commentId)))
		return stale("Restricted comment", "Comment");

	if (comment.parentType === "task") {
		const task = await ctx.db.get(
			"tasks",
			getCommentParentId("task", comment.parentId),
		);
		return task
			? {
					label: `Comment on ${task.identifier}`,
					description: "Task comment",
					isStale: false,
				}
			: stale("Comment on deleted task", "Task comment");
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", comment.parentId),
	);
	if (!update)
		return stale("Comment on deleted update", "Competition update comment");
	const competition = await ctx.db.get("competitions", update.competitionId);
	return {
		label: competition
			? `Comment on ${competition.name}`
			: "Comment on competition update",
		description: "Competition update comment",
		isStale: competition === null,
	};
}

export const listSubscriptions = query({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.array(notificationSubscriptionReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeSubscriptionListLimit(args.limit);
		const docs = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_updated_at", (q) => q.eq("userId", userId))
			.order("desc")
			.take(limit);

		const rows = await Promise.all(
			docs.map(async (doc) => {
				const presentation = await describeEntitySubscription(
					ctx,
					userId,
					doc.entityType,
					doc.entityId,
				);
				return {
					id: doc._id,
					entityType: doc.entityType,
					entityId: doc.entityId,
					label: presentation.label,
					description: presentation.description,
					isStale: presentation.isStale,
					updatedAt: toISO(doc.updatedAt),
				};
			}),
		);
		return rows;
	},
});

function findUserEntitySubscription(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
	entityType: "task" | "competition" | "comment",
	entityId: string,
) {
	return ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_user_entity", (q) =>
			q
				.eq("userId", userId)
				.eq("entityType", entityType)
				.eq("entityId", entityId),
		)
		.first();
}

function entityRefFromSubscriptionArg(
	entity: EntitySubscriptionArg,
): NotificationEntityRef {
	return entity.entityType === "comment"
		? { entityType: "comment", entityId: entity.entityId }
		: entity;
}

export const isSubscribedToEntity = query({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (!existing) return false;
		return canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(args.entity),
		);
	},
});

export const subscribeToEntity = mutation({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.id("notificationSubscriptions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await ensureSubscriptionEntityAccess(ctx, userId, args.entity);

		const entityId = `${args.entity.entityId}`;
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			entityId,
		);
		if (existing) return existing._id;

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			entityType: args.entity.entityType,
			entityId,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromEntity = mutation({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (existing)
			await ctx.db.delete("notificationSubscriptions", existing._id);
		return null;
	},
});

export const unsubscribe = mutation({
	args: {
		subscriptionId: v.id("notificationSubscriptions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db.get(
			"notificationSubscriptions",
			args.subscriptionId,
		);
		if (!existing || existing.userId !== userId) {
			return null;
		}
		await ctx.db.delete("notificationSubscriptions", args.subscriptionId);
		return null;
	},
});

export const getDispatchStats = query({
	args: {},
	returns: notificationDispatchStatsReturns,
	handler: async (ctx) => {
		await requireUserId(ctx);
		const health = await queryEmailDispatchHealth(ctx);
		return {
			pending:
				health.totals.queued +
				health.totals.sending +
				health.totals.awaitingProvider,
			sent: health.totals.sent,
			skipped: health.totals.canceled,
			failed: health.totals.deadLetter,
		};
	},
});

export const getDispatchHealth = query({
	args: {},
	returns: notificationDispatchHealthReturns,
	handler: async (ctx) => {
		await requireDirector(ctx);
		const health = await queryEmailDispatchHealth(ctx);
		const pendingCount =
			health.totals.queued +
			health.totals.sending +
			health.totals.awaitingProvider;
		const channel: NotificationChannel = "email";
		return {
			totals: {
				pending: pendingCount,
				sent: health.totals.sent,
				skipped: health.totals.canceled,
				failed: health.totals.deadLetter,
			},
			byChannel: [
				{
					channel,
					pending: pendingCount,
					sent: health.totals.sent,
					skipped: health.totals.canceled,
					failed: health.totals.deadLetter,
				},
			],
			stalePendingCount: health.staleQueuedCount,
			deadLettersLast24h: health.deadLettersLast24h,
		};
	},
});

export const listRecentDeadLetters = query({
	args: {
		limit: v.optional(v.number()),
		channel: v.optional(notificationChannel),
	},
	returns: v.array(notificationDeadLetterReturns),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const deadLetters = await queryRecentEmailDeadLetters(ctx, {
			limit: args.limit,
		});
		const channel: NotificationChannel = "email";
		return deadLetters.map((item) => ({
			id: item.id,
			dispatchId: item.dispatchId,
			eventId: undefined,
			userId: undefined,
			userName: undefined,
			userEmail: item.recipientEmail,
			channel,
			error: item.error,
			attempts: item.sendAttemptCount,
			eventType: undefined,
			entityType: undefined,
			entityId: item.sourceRef,
			failedAt: item.failedAt,
		}));
	},
});

export const sendTestDigestSeries = mutation({
	args: {
		toEmail: v.optional(v.string()),
	},
	returns: v.object({
		toEmail: v.string(),
		queued: v.boolean(),
		emailCount: v.number(),
	}),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const userId = await requireUserId(ctx);
		const user = await ctx.db.get("users", userId);

		const fallbackEmail = normalizeEmail(user?.email);
		const toEmail = normalizeEmail(args.toEmail ?? fallbackEmail);
		if (!toEmail || !validateEmail(toEmail)) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Enter a valid recipient email for test digest sends.",
			});
		}

		const actorName = user?.name ?? "Test User";
		for (const type of ["immediate", "hourly", "three_daily"] as const) {
			await ctx.scheduler.runAfter(0, internal.notifications._sendTestEmail, {
				type,
				toEmail,
				recipientName: user?.name,
				actorName,
			});
		}

		return {
			toEmail,
			queued: true,
			emailCount: 3,
		};
	},
});

async function emitFromConfig(
	ctx: MutationCtx,
	config: NotificationTemplateConfig,
	opts: Omit<
		NotificationEmitInput,
		| "title"
		| "message"
		| "priority"
		| "metadata"
		| "body"
		| "isBatchable"
		| "batchKey"
	>,
): Promise<Id<"notifications"> | null> {
	const emitInput = buildNotificationEmitInput({
		eventKey: opts.type,
		base: {
			...opts,
			title: config.title,
			message: config.message,
			priority: config.priority,
			metadata: config.metadata,
			body: config.body,
			isBatchable: config.isBatchable,
			batchKey: config.batchKey,
		},
		overrides: {
			includeEntitySubscribers: opts.includeEntitySubscribers,
			suppressActorRecipient: opts.suppressActorRecipient,
		},
	});
	const inserted = await emitInAppNotifications(ctx, emitInput);
	return inserted[0] ?? null;
}

async function createTaskNotification(
	ctx: MutationCtx,
	type: TaskNotificationType,
	args: TaskNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) return null;

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const result = await buildTaskNotificationResult(
		ctx,
		type,
		task,
		actor,
		args,
		{ type, taskId: task._id, eventKey },
	);
	if (!result) return null;

	const isTargeted = type === "task_mentioned" || type === "comment_replied";
	return emitFromConfig(ctx, result.config, {
		type,
		entity: result.entity,
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${type}:${task._id}:${task.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		...(isTargeted ? { includeEntitySubscribers: false } : {}),
	});
}

async function createCompetitionNotification(
	ctx: MutationCtx,
	args: CompetitionNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const competition = await ctx.db.get("competitions", args.competitionId);
	if (!competition) return null;

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const result = buildCompetitionNotificationResult(competition, actor, args, {
		type: args.type,
		competitionId: args.competitionId,
		eventKey,
	});
	if (!result) return null;

	return emitFromConfig(ctx, result.config, {
		type: args.type,
		entity: { entityType: "competition", entityId: competition._id },
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${args.type}:${competition._id}:${competition.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
	});
}

async function createReminderNotification(
	ctx: MutationCtx,
	args: {
		reminderId: Id<"reminders">;
		userId: Id<"users">;
		taskId: Id<"tasks">;
		message?: string;
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const reminder = await ctx.db.get("reminders", args.reminderId);
	if (!reminder) return null;

	const task = await ctx.db.get("tasks", args.taskId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	return emitFromConfig(
		ctx,
		NotificationTemplates.reminder_triggered(task ?? args.taskId, args.message),
		{
			type: "reminder_triggered",
			entity: {
				entityType: "reminder",
				entityId: reminder._id,
				parentTaskId: args.taskId,
			},
			recipients: [args.userId],
			idempotencyBase: `reminder_triggered:${reminder._id}:${eventKey}`,
			payloadJson: serializePayload({
				reminderId: reminder._id,
				taskId: args.taskId,
				eventKey,
			}),
			includeEntitySubscribers: false,
			suppressActorRecipient: false,
		},
	);
}

type TaskEventType = TaskNotificationType;

type BaseTaskEventArgs = {
	taskId: Id<"tasks">;
	actorId: Id<"users">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	eventKey?: string;
};

type EmitNotificationEventArgs =
	| ({ type: "task_assigned" | "task_unassigned" } & BaseTaskEventArgs)
	| ({
			type: "task_mentioned" | "comment_added" | "comment_replied";
			commentId: Id<"comments">;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_status_changed";
			oldStatus: string;
			newStatus: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_priority_changed";
			oldPriority: string;
			newPriority: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_awaiting_review" | "task_approved" | "task_unapproved";
	  } & BaseTaskEventArgs)
	| ({
			type: "due_date_changed";
			oldDueDate?: string;
			newDueDate?: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "relation_blocked" | "relation_unblocked";
			blockingTaskId: Id<"tasks">;
	  } & BaseTaskEventArgs)
	| {
			type: "due_date_approaching";
			taskId: Id<"tasks">;
			assigneeId: Id<"users">;
			daysUntil: number;
			eventKey?: string;
	  }
	| {
			type: "due_date_overdue";
			taskId: Id<"tasks">;
			assigneeId: Id<"users">;
			daysOverdue: number;
			eventKey?: string;
	  }
	| {
			type: "competition_phase_changed";
			competitionId: Id<"competitions">;
			recipientId?: Id<"users">;
			recipientIds?: Id<"users">[];
			actorId: Id<"users">;
			oldPhaseName: string;
			newPhaseName: string;
			eventKey?: string;
	  }
	| {
			type: "progress_update_added";
			competitionId: Id<"competitions">;
			recipientId?: Id<"users">;
			recipientIds?: Id<"users">[];
			actorId: Id<"users">;
			competitionName: string;
			status: "on-track" | "at-risk" | "off-track";
			eventKey?: string;
	  }
	| {
			type: "reminder_triggered";
			reminderId: Id<"reminders">;
			userId: Id<"users">;
			taskId: Id<"tasks">;
			message?: string;
			eventKey?: string;
	  };

function mapTaskEventArgs(args: {
	type: TaskEventType;
	taskId: Id<"tasks">;
	actorId: Id<"users">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	commentId?: Id<"comments">;
	oldStatus?: string;
	newStatus?: string;
	oldPriority?: string;
	newPriority?: string;
	oldDueDate?: string;
	newDueDate?: string;
	blockingTaskId?: Id<"tasks">;
	eventKey?: string;
}): TaskNotificationBuildArgs {
	return {
		taskId: args.taskId,
		actorId: args.actorId,
		recipientId: args.recipientId,
		recipientIds: args.recipientIds,
		commentId: args.commentId,
		oldStatus: args.oldStatus,
		newStatus: args.newStatus,
		oldPriority: args.oldPriority,
		newPriority: args.newPriority,
		oldDueDate: args.oldDueDate,
		newDueDate: args.newDueDate,
		blockingTaskId: args.blockingTaskId,
		eventKey: args.eventKey,
	};
}

export async function emitNotificationEvent(
	ctx: MutationCtx,
	args: EmitNotificationEventArgs,
): Promise<Id<"notifications"> | null> {
	switch (args.type) {
		case "task_assigned":
		case "task_unassigned":
		case "task_mentioned":
		case "comment_added":
		case "comment_replied":
		case "task_status_changed":
		case "task_priority_changed":
		case "task_awaiting_review":
		case "task_approved":
		case "task_unapproved":
		case "due_date_changed":
		case "relation_blocked":
		case "relation_unblocked":
			return createTaskNotification(ctx, args.type, mapTaskEventArgs(args));
		case "due_date_approaching":
			return emitDueDateUrgencyNotification(ctx, "due_date_approaching", {
				taskId: args.taskId,
				assigneeId: args.assigneeId,
				days: args.daysUntil,
				eventKey: args.eventKey,
			});
		case "due_date_overdue":
			return emitDueDateUrgencyNotification(ctx, "due_date_overdue", {
				taskId: args.taskId,
				assigneeId: args.assigneeId,
				days: args.daysOverdue,
				eventKey: args.eventKey,
			});
		case "competition_phase_changed":
		case "progress_update_added":
			return createCompetitionNotification(ctx, args);
		case "reminder_triggered":
			return createReminderNotification(ctx, args);
		default: {
			const _exhaustive: never = args;
			return _exhaustive;
		}
	}
}

async function emitDueDateUrgencyNotification(
	ctx: MutationCtx,
	type: "due_date_approaching" | "due_date_overdue",
	args: {
		taskId: Id<"tasks">;
		assigneeId: Id<"users">;
		days: number;
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task?.dueDate) return null;

	const config =
		type === "due_date_approaching"
			? NotificationTemplates.due_date_approaching(task, args.days)
			: NotificationTemplates.due_date_overdue(task, args.days);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	return emitFromConfig(ctx, config, {
		type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [args.assigneeId],
		idempotencyBase: `${type}:${task._id}:${args.days}:${eventKey}`,
		payloadJson: serializePayload({
			taskId: task._id,
			...(type === "due_date_approaching"
				? { daysUntil: args.days }
				: { daysOverdue: args.days }),
			eventKey,
		}),
		includeEntitySubscribers: true,
	});
}

export const _composeNotificationEmailStageGroup = internalMutation({
	args: {
		userId: v.id("users"),
		digestMode: notificationDigestMode,
		digestWindowKey: v.optional(v.string()),
	},
	returns: v.object({
		staged: v.number(),
		queued: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const stageRows = await ctx.db
			.query("notificationEmailStageItems")
			.withIndex("by_user_mode_window_status", (q) =>
				q
					.eq("userId", args.userId)
					.eq("digestMode", args.digestMode)
					.eq("digestWindowKey", args.digestWindowKey)
					.eq("status", "pending"),
			)
			.collect();
		const now = Date.now();
		const dueRows = stageRows.filter((row) => row.scheduledFor <= now);
		if (dueRows.length === 0) {
			return { staged: 0, queued: false };
		}
		const pendingCount = stageRows.length;

		const user = await ctx.db.get("users", args.userId);
		if (!user?.email) {
			await clearScheduledFunctionForRows(
				ctx,
				dueRows,
				{ status: "skipped" },
				now,
			);
			await scheduleNextPendingNotificationEmailStageGroup(
				ctx,
				args,
				pendingCount,
				dueRows.length,
			);
			return { staged: dueRows.length, queued: false };
		}

		const items: Array<{
			type: NotificationType;
			title: string;
			message: string;
			body?: string;
			entityType: string;
			entityId: string;
			parentEntityId?: string;
			priority: string;
			actorName?: string;
		}> = [];

		for (const row of dueRows) {
			if (row.notificationId) {
				const notification = await ctx.db.get(
					"notifications",
					row.notificationId,
				);
				if (notification) {
					items.push({
						type: notification.type,
						title: notification.title,
						message: notification.message,
						body: notification.body,
						entityType: notification.entityType,
						entityId: notification.entityId,
						parentEntityId: notification.parentEntityId,
						priority: notification.priority,
						actorName: notification.metadata?.actorName,
					});
					continue;
				}
			}

			const snapshot = parseEmailDispatchSnapshot(row.metadataJson);
			if (snapshot) {
				items.push(snapshot);
			}
		}

		if (items.length === 0) {
			await clearScheduledFunctionForRows(
				ctx,
				dueRows,
				{ status: "skipped" },
				now,
			);
			await scheduleNextPendingNotificationEmailStageGroup(
				ctx,
				args,
				pendingCount,
				dueRows.length,
			);
			return { staged: dueRows.length, queued: false };
		}

		const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
		const composed = await buildNotificationGroupEmailContent({
			digestMode: args.digestMode,
			isQuietHoursBatch:
				args.digestMode === "immediate" &&
				isQuietHoursDigestWindowKey(args.digestWindowKey),
			items: mapDispatchItemsToEmailGroupItems({
				appUrl,
				items,
			}),
			appUrl,
		});
		const dedupeKey = buildNotificationGroupIdempotencyKey({
			digestMode: args.digestMode,
			digestWindowKey: args.digestWindowKey,
			recipientEmail: user.email,
		});
		const queued = await enqueueDispatch(ctx, {
			dedupeKey,
			sourceKind: "notification",
			sourceRef: buildNotificationGroupSourceRef({
				userId: args.userId,
				digestMode: args.digestMode,
				digestWindowKey: args.digestWindowKey,
			}),
			templateKey: composed.emailType,
			recipientEmail: user.email,
			recipientName: user.name,
			subject: composed.subject,
			htmlBody: composed.htmlBody,
			plainTextBody: composed.plainTextBody,
			payloadJson: JSON.stringify({
				userId: args.userId,
				digestMode: args.digestMode,
				digestWindowKey: args.digestWindowKey,
				stageIds: dueRows.map((row) => row._id),
			}),
		});

		await clearScheduledFunctionForRows(
			ctx,
			dueRows,
			{
				status: "composed",
				emailDispatchId: queued.dispatchId,
			},
			now,
		);
		await scheduleNextPendingNotificationEmailStageGroup(
			ctx,
			args,
			pendingCount,
			dueRows.length,
		);

		return {
			staged: dueRows.length,
			queued: queued.created,
		};
	},
});

export const _recoverPendingNotificationEmailStages = internalMutation({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.object({
		rows: v.number(),
		groups: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));
		const pendingRows = await ctx.db
			.query("notificationEmailStageItems")
			.withIndex("by_status_scheduled_for", (q) =>
				q.eq("status", "pending").lte("scheduledFor", now),
			)
			.take(limit);

		const groups = new Map<
			string,
			{
				userId: Id<"users">;
				digestMode: "immediate" | "hourly" | "daily" | "three_daily";
				digestWindowKey?: string;
			}
		>();

		for (const row of pendingRows) {
			const key = `${row.userId}:${row.digestMode}:${row.digestWindowKey ?? ""}`;
			if (groups.has(key)) {
				continue;
			}
			groups.set(key, {
				userId: row.userId,
				digestMode: row.digestMode,
				digestWindowKey: row.digestWindowKey,
			});
		}

		for (const group of groups.values()) {
			await ensureNotificationEmailStageGroupScheduled(ctx, group);
		}

		return {
			rows: pendingRows.length,
			groups: groups.size,
		};
	},
});

export const _sendTestEmail = internalAction({
	args: {
		type: v.union(
			v.literal("immediate"),
			v.literal("hourly"),
			v.literal("three_daily"),
		),
		toEmail: v.string(),
		recipientName: v.optional(v.string()),
		actorName: v.string(),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		await sendTestEmailPreview(args);
		return null;
	},
});

async function emitDueDateNotification(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	recipientId: Id<"users">,
	spec: DueDateNotificationSpec,
): Promise<number> {
	const result = await emitFromConfig(ctx, spec.config, {
		type: spec.type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [recipientId],
		idempotencyBase: spec.idempotencyBase,
		payloadJson: serializePayload(spec.payload),
		includeEntitySubscribers: true,
	});
	return result ? 1 : 0;
}

async function maybeEmitDueDateNotificationForTask(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	now: number,
): Promise<number> {
	if (
		!task.dueDate ||
		!task.assigneeId ||
		task.status === "done" ||
		task.status === "cancelled"
	) {
		return 0;
	}

	const daysDiff = computeDueDateDaysDiff(task.dueDate, now);
	const dayBucket = Math.floor(now / MS_PER_DAY);
	const spec = buildDueDateNotificationSpec(task, daysDiff, dayBucket);
	if (!spec) {
		return 0;
	}

	return emitDueDateNotification(ctx, task, task.assigneeId, spec);
}

export async function emitDueDateNotificationsForTask(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	now: number = Date.now(),
): Promise<number> {
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		return 0;
	}
	return maybeEmitDueDateNotificationForTask(ctx, task, now);
}

export const _checkDueDates = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_archived", (q) => q.eq("archived", false))
			.collect();
		let notificationCount = 0;

		for (const task of tasks) {
			notificationCount += await maybeEmitDueDateNotificationForTask(
				ctx,
				task,
				now,
			);
		}

		return notificationCount;
	},
});
