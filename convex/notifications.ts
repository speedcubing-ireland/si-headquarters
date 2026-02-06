import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";
import type { Infer } from "convex/values";
import { hasCompetitionAccess } from "./competitionAccess";
import { hasTaskCompetitionAccess } from "./taskAccess";
import { getCommentParentId } from "./lib/commentParentId";
import {
	NOTIFICATION_TYPES,
	notificationChannel,
	notificationDigestMode,
	notificationMetadata,
	notificationPriority,
	notificationStatus,
	notificationSubscriberEntityType,
	notificationSubscriptionType,
	notificationType,
} from "./lib/validators";
import {
	NOTIFICATION_DEFAULTS,
	NOTIFICATION_THRESHOLDS,
	NOTIFICATION_LIST_LIMITS,
	MINUTES_IN_DAY,
} from "./lib/constants";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType,
} from "./lib/notificationTemplates";
import {
	computeDispatchSchedule,
	validateQuietHoursWindow,
	validateTimezone,
} from "./lib/notificationScheduling";
import {
	matchesCompetitionViewFilters,
	matchesTaskViewFilters,
} from "./lib/notificationViewMatchers";
import { toISO } from "./lib/transforms";

const IN_APP_CHANNEL: NotificationChannel = "in_app";
const SUPPORTED_NOTIFICATION_CHANNELS: NotificationChannel[] = [IN_APP_CHANNEL];
const EXTERNAL_NOTIFICATION_CHANNELS: NotificationChannel[] = [];
const DEFAULT_DIGEST_MODE: NotificationDigestMode = "immediate";
const DEFAULT_TIMEZONE = NOTIFICATION_DEFAULTS.TIMEZONE;
const DEFAULT_SUBSCRIPTION_LIST_LIMIT = 100;
const MAX_SUBSCRIPTION_LIST_LIMIT = NOTIFICATION_LIST_LIMITS.MAX;

type NotificationMetadata = Infer<typeof notificationMetadata>;
type NotificationType = Infer<typeof notificationType>;
type NotificationPriority = Infer<typeof notificationPriority>;
type NotificationChannel = Infer<typeof notificationChannel>;
type NotificationDigestMode = Infer<typeof notificationDigestMode>;
type NotificationSubscriberEntityType = Infer<
	typeof notificationSubscriberEntityType
>;
type NotificationViewEntityType = "tasks" | "competitions";
type EntitySubscriptionArg = Infer<typeof entitySubscriptionArgs>;

type NotificationEntityType = "task" | "comment" | "competition" | "reminder";
type DispatchStatus = "pending" | "sent" | "skipped" | "failed";

const notificationEntityType = v.union(
	v.literal("task"),
	v.literal("comment"),
	v.literal("competition"),
	v.literal("reminder"),
);

export const notificationReturns = v.object({
	id: v.id("notifications"),
	userId: v.id("users"),
	type: notificationType,
	priority: notificationPriority,
	status: notificationStatus,
	title: v.string(),
	message: v.string(),
	body: v.optional(v.string()),
	entityType: notificationEntityType,
	entityId: v.string(),
	parentEntityId: v.optional(v.string()),
	metadata: notificationMetadata,
	sourceEventId: v.optional(v.id("notificationEvents")),
	threadKey: v.optional(v.string()),
	dedupeKey: v.optional(v.string()),
	createdAt: v.string(),
	readAt: v.optional(v.string()),
	archivedAt: v.optional(v.string()),
	snoozedUntil: v.optional(v.string()),
	scheduledFor: v.optional(v.string()),
	isBatchable: v.boolean(),
	batchKey: v.optional(v.string()),
});

const notificationPreferenceReturns = v.object({
	type: notificationType,
	channel: notificationChannel,
	enabled: v.boolean(),
	digestMode: notificationDigestMode,
	respectQuietHours: v.boolean(),
	isOverride: v.boolean(),
	updatedAt: v.string(),
});

const notificationUserSettingsReturns = v.object({
	timezone: v.string(),
	defaultDigestMode: notificationDigestMode,
	quietHoursStartMin: v.optional(v.number()),
	quietHoursEndMin: v.optional(v.number()),
	updatedAt: v.string(),
});

const notificationSettingsReturns = v.object({
	timezone: v.string(),
	defaultDigestMode: notificationDigestMode,
	quietHoursStartMin: v.optional(v.number()),
	quietHoursEndMin: v.optional(v.number()),
	preferences: v.array(notificationPreferenceReturns),
});

const notificationSubscriptionReturns = v.object({
	id: v.id("notificationSubscriptions"),
	subscriptionType: notificationSubscriptionType,
	entityType: v.optional(notificationSubscriberEntityType),
	entityId: v.optional(v.string()),
	viewId: v.optional(v.id("savedViews")),
	viewEntity: v.optional(
		v.union(v.literal("tasks"), v.literal("competitions")),
	),
	label: v.string(),
	description: v.optional(v.string()),
	isStale: v.boolean(),
	updatedAt: v.string(),
});

const notificationDispatchStatsReturns = v.object({
	pending: v.number(),
	sent: v.number(),
	skipped: v.number(),
	failed: v.number(),
});

const entitySubscriptionArgs = v.union(
	v.object({
		entityType: v.literal("task"),
		entityId: v.id("tasks"),
	}),
	v.object({
		entityType: v.literal("competition"),
		entityId: v.id("competitions"),
	}),
	v.object({
		entityType: v.literal("comment"),
		entityId: v.id("comments"),
	}),
);

type NotificationEntityRef =
	| { entityType: "task"; entityId: Id<"tasks"> }
	| { entityType: "competition"; entityId: Id<"competitions"> }
	| {
			entityType: "comment";
			entityId: Id<"comments">;
			parentTaskId?: Id<"tasks">;
	  }
	| {
			entityType: "reminder";
			entityId: Id<"reminders">;
			parentTaskId?: Id<"tasks">;
	  };

type NotificationEmitInput = {
	type: NotificationType;
	entity: NotificationEntityRef;
	recipients: Id<"users">[];
	actorId?: Id<"users">;
	title: string;
	message: string;
	priority: NotificationPriority;
	body?: string;
	metadata?: NotificationMetadata;
	threadKey?: string;
	dedupeKey?: string;
	isBatchable?: boolean;
	batchKey?: string;
	idempotencyBase: string;
	payloadJson?: string;
	includeEntitySubscribers?: boolean;
	includeViewSubscribers?: boolean;
	suppressActorRecipient?: boolean;
};

type NotificationPayload = Record<
	string,
	string | number | boolean | null | undefined
>;

type NotificationPreferenceConfig = {
	enabled: boolean;
	digestMode: NotificationDigestMode;
	respectQuietHours: boolean;
	quietHoursStartMin?: number;
	quietHoursEndMin?: number;
};

type RecipientSkipDecision = {
	inAppStatus: DispatchStatus;
	externalStatus: DispatchStatus;
	reason: string;
	externalReason?: string;
};

type RecipientDecision =
	| {
			kind: "existing";
			notification: Doc<"notifications">;
	  }
	| {
			kind: "skip";
			skip: RecipientSkipDecision;
	  }
	| {
			kind: "deliver";
			inAppPreference: NotificationPreferenceConfig;
	  };

function docToNotification(d: Doc<"notifications">) {
	return {
		id: d._id,
		userId: d.userId,
		type: d.type,
		priority: d.priority,
		status: d.status,
		title: d.title,
		message: d.message,
		body: d.body,
		entityType: d.entityType,
		entityId: d.entityId,
		parentEntityId: d.parentEntityId,
		metadata: d.metadata ?? {},
		sourceEventId: d.sourceEventId,
		threadKey: d.threadKey,
		dedupeKey: d.dedupeKey,
		createdAt: toISO(d._creationTime),
		readAt: d.readAt !== undefined ? toISO(d.readAt) : undefined,
		archivedAt: d.archivedAt !== undefined ? toISO(d.archivedAt) : undefined,
		snoozedUntil:
			d.snoozedUntil !== undefined ? toISO(d.snoozedUntil) : undefined,
		scheduledFor:
			d.scheduledFor !== undefined ? toISO(d.scheduledFor) : undefined,
		isBatchable: d.isBatchable,
		batchKey: d.batchKey,
	};
}

function normalizeListLimit(limit: number | undefined): number {
	if (!limit || Number.isNaN(limit)) {
		return NOTIFICATION_LIST_LIMITS.DEFAULT;
	}
	if (limit < 1) {
		return 1;
	}
	if (limit > NOTIFICATION_LIST_LIMITS.MAX) {
		return NOTIFICATION_LIST_LIMITS.MAX;
	}
	return limit;
}

function normalizeSubscriptionListLimit(limit: number | undefined): number {
	if (!limit || Number.isNaN(limit)) {
		return DEFAULT_SUBSCRIPTION_LIST_LIMIT;
	}
	if (limit < 1) {
		return 1;
	}
	if (limit > MAX_SUBSCRIPTION_LIST_LIMIT) {
		return MAX_SUBSCRIPTION_LIST_LIMIT;
	}
	return limit;
}

function validateQuietHour(value: number | undefined, fieldName: string): void {
	if (value === undefined) return;
	const maxMinute = MINUTES_IN_DAY - 1;
	if (!Number.isInteger(value) || value < 0 || value > maxMinute) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${fieldName} must be an integer between 0 and ${maxMinute}`,
		});
	}
}

function validateQuietHours(
	quietHoursStartMin: number | undefined,
	quietHoursEndMin: number | undefined,
): void {
	validateQuietHour(quietHoursStartMin, "quietHoursStartMin");
	validateQuietHour(quietHoursEndMin, "quietHoursEndMin");
	validateQuietHoursWindow(quietHoursStartMin, quietHoursEndMin);
}

function serializePayload(payload: NotificationPayload): string | undefined {
	const normalized: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(payload)) {
		if (value !== undefined) {
			normalized[key] = value;
		}
	}
	if (Object.keys(normalized).length === 0) {
		return undefined;
	}
	return JSON.stringify(normalized);
}

function notificationEntityId(entity: NotificationEntityRef): string {
	return entity.entityId;
}

function notificationParentEntityId(
	entity: NotificationEntityRef,
): string | undefined {
	if (entity.entityType === "comment" || entity.entityType === "reminder") {
		return entity.parentTaskId;
	}
	return undefined;
}

function defaultThreadKey(entity: NotificationEntityRef): string {
	if (
		(entity.entityType === "comment" || entity.entityType === "reminder") &&
		entity.parentTaskId
	) {
		return `task:${entity.parentTaskId}`;
	}
	return `${entity.entityType}:${entity.entityId}`;
}

type DbReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type NotificationUserSettingsResolved = {
	timezone: string;
	defaultDigestMode: NotificationDigestMode;
	quietHoursStartMin: number | undefined;
	quietHoursEndMin: number | undefined;
	updatedAt: number;
};

async function getNotificationUserSettingsDoc(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<Doc<"notificationUserSettings"> | null> {
	return ctx.db
		.query("notificationUserSettings")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
}

function resolveNotificationUserSettings(
	doc: Doc<"notificationUserSettings"> | null,
): NotificationUserSettingsResolved {
	return {
		timezone: doc?.timezone ?? DEFAULT_TIMEZONE,
		defaultDigestMode: doc?.defaultDigestMode ?? DEFAULT_DIGEST_MODE,
		quietHoursStartMin: doc?.quietHoursStartMin,
		quietHoursEndMin: doc?.quietHoursEndMin,
		updatedAt: doc?.updatedAt ?? 0,
	};
}

async function getResolvedNotificationUserSettings(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<NotificationUserSettingsResolved> {
	const doc = await getNotificationUserSettingsDoc(ctx, userId);
	return resolveNotificationUserSettings(doc);
}

async function getNotificationUserTimezone(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<string> {
	const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
	return userSettings.timezone;
}

async function upsertNotificationUserSettings(
	ctx: MutationCtx,
	userId: Id<"users">,
	args: {
		timezone?: string;
		defaultDigestMode?: NotificationDigestMode;
		quietHoursStartMin?: number;
		quietHoursEndMin?: number;
		clearQuietHours?: boolean;
	},
): Promise<void> {
	const existing = await getNotificationUserSettingsDoc(ctx, userId);
	const resolved = resolveNotificationUserSettings(existing);

	const timezone = args.timezone ?? resolved.timezone;
	const defaultDigestMode =
		args.defaultDigestMode ?? resolved.defaultDigestMode;
	if (args.timezone !== undefined) {
		validateTimezone(args.timezone);
	}

	let quietHoursStartMin = resolved.quietHoursStartMin;
	let quietHoursEndMin = resolved.quietHoursEndMin;
	if (args.clearQuietHours) {
		quietHoursStartMin = undefined;
		quietHoursEndMin = undefined;
	} else if (
		args.quietHoursStartMin !== undefined ||
		args.quietHoursEndMin !== undefined
	) {
		quietHoursStartMin = args.quietHoursStartMin;
		quietHoursEndMin = args.quietHoursEndMin;
	}
	validateQuietHours(quietHoursStartMin, quietHoursEndMin);

	const now = Date.now();
	if (existing) {
		await ctx.db.patch(existing._id, {
			timezone,
			defaultDigestMode,
			quietHoursStartMin,
			quietHoursEndMin,
			updatedAt: now,
		});
		return;
	}
	await ctx.db.insert("notificationUserSettings", {
		userId,
		timezone,
		defaultDigestMode,
		quietHoursStartMin,
		quietHoursEndMin,
		updatedAt: now,
	});
}

function defaultChannelEnabled(channel: NotificationChannel): boolean {
	return channel === IN_APP_CHANNEL;
}

function assertSupportedChannel(channel: NotificationChannel): void {
	if (SUPPORTED_NOTIFICATION_CHANNELS.includes(channel)) {
		return;
	}
	throw new ConvexError({
		code: "BAD_REQUEST",
		message: `${channel} notifications are not yet supported`,
	});
}

async function getNotificationPreferenceConfig(
	ctx: Pick<MutationCtx, "db">,
	userId: Id<"users">,
	type: NotificationType,
	channel: NotificationChannel,
): Promise<NotificationPreferenceConfig> {
	const [override, userSettings] = await Promise.all([
		ctx.db
			.query("notificationPreferences")
			.withIndex("by_user_type_channel", (q) =>
				q.eq("userId", userId).eq("type", type).eq("channel", channel),
			)
			.first(),
		getResolvedNotificationUserSettings(ctx, userId),
	]);
	const respectQuietHours = override?.respectQuietHours ?? true;
	const effectiveDigestMode =
		channel === IN_APP_CHANNEL
			? override
				? "immediate"
				: userSettings.defaultDigestMode
			: (override?.digestMode ?? userSettings.defaultDigestMode);

	return {
		enabled: override?.enabled ?? defaultChannelEnabled(channel),
		digestMode: effectiveDigestMode,
		respectQuietHours,
		quietHoursStartMin: respectQuietHours
			? userSettings.quietHoursStartMin
			: undefined,
		quietHoursEndMin: respectQuietHours
			? userSettings.quietHoursEndMin
			: undefined,
	};
}

async function upsertEnabledExternalDispatches(
	ctx: MutationCtx,
	args: {
		eventId: Id<"notificationEvents">;
		userId: Id<"users">;
		type: NotificationType;
		status: DispatchStatus;
		reason?: string;
	},
): Promise<void> {
	if (EXTERNAL_NOTIFICATION_CHANNELS.length === 0) {
		return;
	}

	const timezone = await getNotificationUserTimezone(ctx, args.userId);
	const now = Date.now();

	type ExternalDispatchPlan = {
		channel: NotificationChannel;
		digestMode: NotificationDigestMode;
		scheduledFor: number;
		digestWindowKey: string | undefined;
	};

	const channelPlans = await Promise.all(
		EXTERNAL_NOTIFICATION_CHANNELS.map(
			async (channel): Promise<ExternalDispatchPlan | null> => {
				const preference = await getNotificationPreferenceConfig(
					ctx,
					args.userId,
					args.type,
					channel,
				);
				if (!preference.enabled) {
					return null;
				}

				const schedule = computeDispatchSchedule({
					now,
					timezone,
					digestMode: preference.digestMode,
					quietHoursStartMin: preference.quietHoursStartMin,
					quietHoursEndMin: preference.quietHoursEndMin,
				});
				return {
					channel,
					digestMode: preference.digestMode,
					scheduledFor: schedule.scheduledFor,
					digestWindowKey: schedule.digestWindowKey,
				};
			},
		),
	);

	const dispatchPlans: ExternalDispatchPlan[] = [];
	for (const plan of channelPlans) {
		if (plan !== null) {
			dispatchPlans.push(plan);
		}
	}

	await Promise.all(
		dispatchPlans.map((plan) =>
			upsertDispatch(ctx, {
				eventId: args.eventId,
				userId: args.userId,
				channel: plan.channel,
				status: args.status,
				digestMode: plan.digestMode,
				scheduledFor: plan.scheduledFor,
				...(plan.digestWindowKey
					? { digestWindowKey: plan.digestWindowKey }
					: {}),
				reason: args.reason,
			}),
		),
	);
}

async function upsertDispatch(
	ctx: MutationCtx,
	args: {
		eventId: Id<"notificationEvents">;
		userId: Id<"users">;
		channel: NotificationChannel;
		status: DispatchStatus;
		digestMode?: NotificationDigestMode;
		scheduledFor?: number;
		digestWindowKey?: string;
		notificationId?: Id<"notifications">;
		reason?: string;
		metadataJson?: string;
	},
): Promise<void> {
	const existing = await ctx.db
		.query("notificationDispatches")
		.withIndex("by_event_user_channel", (q) =>
			q
				.eq("eventId", args.eventId)
				.eq("userId", args.userId)
				.eq("channel", args.channel),
		)
		.first();

	const now = Date.now();
	const attempts = (existing?.attempts ?? 0) + 1;
	const sentAt = args.status === "sent" ? now : existing?.sentAt;
	const digestMode =
		args.digestMode ?? existing?.digestMode ?? DEFAULT_DIGEST_MODE;
	const scheduledFor =
		args.scheduledFor ??
		existing?.scheduledFor ??
		(args.status === "pending" ? now : undefined);
	const digestWindowKey = args.digestWindowKey ?? existing?.digestWindowKey;

	if (existing) {
		await ctx.db.patch(existing._id, {
			notificationId: args.notificationId ?? existing.notificationId,
			status: args.status,
			digestMode,
			scheduledFor,
			digestWindowKey,
			reason: args.reason,
			metadataJson: args.metadataJson,
			attempts,
			lastAttemptAt: now,
			sentAt,
			updatedAt: now,
		});
		return;
	}

	await ctx.db.insert("notificationDispatches", {
		eventId: args.eventId,
		notificationId: args.notificationId,
		userId: args.userId,
		channel: args.channel,
		status: args.status,
		digestMode,
		scheduledFor,
		digestWindowKey,
		reason: args.reason,
		metadataJson: args.metadataJson,
		attempts,
		lastAttemptAt: now,
		sentAt,
		updatedAt: now,
	});
}

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

async function canUserAccessTask(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	taskId: Id<"tasks">,
): Promise<boolean> {
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		return false;
	}

	const volunteer = await isVolunteer(ctx);
	if (volunteer) {
		return true;
	}

	if (!task.parentCompetitionId) {
		return false;
	}

	return hasTaskCompetitionAccess(
		ctx,
		volunteer,
		userId,
		task.parentCompetitionId,
	);
}

async function canUserAccessCompetition(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	competitionId: Id<"competitions">,
): Promise<boolean> {
	const volunteer = await isVolunteer(ctx);
	return hasCompetitionAccess(ctx, volunteer, userId, competitionId);
}

async function canUserAccessComment(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	commentId: Id<"comments">,
	parentTaskId?: Id<"tasks">,
): Promise<boolean> {
	if (parentTaskId) {
		return canUserAccessTask(ctx, userId, parentTaskId);
	}

	const comment = await ctx.db.get("comments", commentId);
	if (!comment) {
		return false;
	}

	if (comment.parentType === "task") {
		return canUserAccessTask(
			ctx,
			userId,
			getCommentParentId("task", comment.parentId),
		);
	}

	const updateId = getCommentParentId("update", comment.parentId);
	const update = await ctx.db.get("competitionUpdates", updateId);
	if (!update) {
		return false;
	}
	return canUserAccessCompetition(ctx, userId, update.competitionId);
}

async function canUserAccessReminder(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	reminderId: Id<"reminders">,
): Promise<boolean> {
	const reminder = await ctx.db.get("reminders", reminderId);
	if (!reminder) {
		return false;
	}
	return reminder.userId === userId;
}

async function canUserAccessNotificationEntity(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	entity: NotificationEntityRef,
): Promise<boolean> {
	switch (entity.entityType) {
		case "task":
			return canUserAccessTask(ctx, userId, entity.entityId);
		case "competition":
			return canUserAccessCompetition(ctx, userId, entity.entityId);
		case "comment":
			return canUserAccessComment(
				ctx,
				userId,
				entity.entityId,
				entity.parentTaskId,
			);
		case "reminder":
			return canUserAccessReminder(ctx, userId, entity.entityId);
	}
}

function subscriberTargetForEntity(entity: NotificationEntityRef): {
	entityType: NotificationSubscriberEntityType;
	entityId: string;
} | null {
	switch (entity.entityType) {
		case "task":
			return {
				entityType: "task",
				entityId: entity.entityId,
			};
		case "competition":
			return {
				entityType: "competition",
				entityId: entity.entityId,
			};
		case "comment":
			if (entity.parentTaskId) {
				return {
					entityType: "task",
					entityId: entity.parentTaskId,
				};
			}
			return {
				entityType: "comment",
				entityId: entity.entityId,
			};
		case "reminder":
			return null;
	}
}

async function getEntitySubscriberIds(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Id<"users">[]> {
	const target = subscriberTargetForEntity(entity);
	if (!target) {
		return [];
	}

	const subscriptions = await ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", target.entityType).eq("entityId", target.entityId),
		)
		.collect();

	const userIds = new Set<Id<"users">>();
	for (const subscription of subscriptions) {
		if (subscription.subscriptionType !== "entity") {
			continue;
		}
		if (
			subscription.entityType !== target.entityType ||
			subscription.entityId !== target.entityId
		) {
			continue;
		}
		userIds.add(subscription.userId);
	}
	return [...userIds];
}

async function resolveTaskForViewSubscription(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"tasks"> | null> {
	if (entity.entityType === "task") {
		return ctx.db.get("tasks", entity.entityId);
	}

	if (entity.entityType === "comment") {
		if (entity.parentTaskId) {
			return ctx.db.get("tasks", entity.parentTaskId);
		}
		const comment = await ctx.db.get("comments", entity.entityId);
		if (!comment || comment.parentType !== "task") {
			return null;
		}
		return ctx.db.get("tasks", getCommentParentId("task", comment.parentId));
	}

	if (entity.entityType === "reminder") {
		if (entity.parentTaskId) {
			return ctx.db.get("tasks", entity.parentTaskId);
		}
		const reminder = await ctx.db.get("reminders", entity.entityId);
		if (!reminder) {
			return null;
		}
		return ctx.db.get("tasks", reminder.entityId);
	}

	return null;
}

async function resolveCompetitionForViewSubscription(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions"> | null> {
	if (entity.entityType === "competition") {
		return ctx.db.get("competitions", entity.entityId);
	}

	if (entity.entityType !== "comment") {
		return null;
	}

	if (entity.parentTaskId) {
		return null;
	}

	const comment = await ctx.db.get("comments", entity.entityId);
	if (!comment || comment.parentType !== "update") {
		return null;
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", comment.parentId),
	);
	if (!update) {
		return null;
	}
	return ctx.db.get("competitions", update.competitionId);
}

function viewEntitiesForNotificationEntity(
	entity: NotificationEntityRef,
): NotificationViewEntityType[] {
	switch (entity.entityType) {
		case "task":
		case "reminder":
			return ["tasks"];
		case "competition":
			return ["competitions"];
		case "comment":
			return entity.parentTaskId ? ["tasks"] : ["tasks", "competitions"];
	}
}

async function getCandidateViewSubscriptions(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"notificationSubscriptions">[]> {
	const viewEntities = viewEntitiesForNotificationEntity(entity);
	if (viewEntities.length === 0) {
		return [];
	}

	const scopedSubscriptions = (
		await Promise.all(
			viewEntities.map((viewEntity) =>
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_type_view_entity", (q) =>
						q.eq("subscriptionType", "view").eq("viewEntity", viewEntity),
					)
					.collect(),
			),
		)
	).flat();

	const legacySubscriptions = await ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_type_view_entity", (q) =>
			q.eq("subscriptionType", "view").eq("viewEntity", undefined),
		)
		.collect();

	const deduped = new Map<
		Id<"notificationSubscriptions">,
		Doc<"notificationSubscriptions">
	>();
	for (const subscription of [...scopedSubscriptions, ...legacySubscriptions]) {
		deduped.set(subscription._id, subscription);
	}
	return [...deduped.values()];
}

async function getViewSubscriberIds(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Id<"users">[]> {
	const subscriptions = await getCandidateViewSubscriptions(ctx, entity);
	if (subscriptions.length === 0) {
		return [];
	}

	const viewCache = new Map<Id<"savedViews">, Doc<"savedViews"> | null>();
	const phaseCache = new Map<Id<"phases">, Doc<"phases"> | null>();
	const userCache = new Map<Id<"users">, Doc<"users"> | null>();

	let taskDoc: Doc<"tasks"> | null | undefined;
	let competitionDoc: Doc<"competitions"> | null | undefined;

	const recipientIds = new Set<Id<"users">>();

	const getUserName = async (
		userId: Id<"users">,
	): Promise<string | undefined> => {
		const cached = userCache.get(userId);
		if (cached !== undefined) {
			return cached?.name ?? undefined;
		}
		const user = await ctx.db.get("users", userId);
		userCache.set(userId, user);
		return user?.name ?? undefined;
	};

	const getPhaseKey = async (
		phaseId: Id<"phases"> | undefined,
	): Promise<string | undefined> => {
		if (!phaseId) {
			return undefined;
		}
		const cached = phaseCache.get(phaseId);
		if (cached !== undefined) {
			return cached?.key;
		}
		const phase = await ctx.db.get("phases", phaseId);
		phaseCache.set(phaseId, phase);
		return phase?.key;
	};

	for (const subscription of subscriptions) {
		if (subscription.subscriptionType !== "view" || !subscription.viewId) {
			continue;
		}

		const cachedView = viewCache.get(subscription.viewId);
		const view =
			cachedView !== undefined
				? cachedView
				: await ctx.db.get("savedViews", subscription.viewId);
		if (cachedView === undefined) {
			viewCache.set(subscription.viewId, view);
		}

		if (!view || view.userId !== subscription.userId) {
			continue;
		}

		if (view.entity === "tasks") {
			if (taskDoc === undefined) {
				taskDoc = await resolveTaskForViewSubscription(ctx, entity);
			}
			if (!taskDoc) {
				continue;
			}

			const matches = matchesTaskViewFilters(
				{
					status: taskDoc.status,
					priority: taskDoc.priority,
					assigneeIds: taskDoc.assigneeId ? [taskDoc.assigneeId] : [],
					labelIds: taskDoc.labelIds,
					ownerIds: taskDoc.ownerId ? [taskDoc.ownerId] : [],
					parentTypes: taskDoc.parentTaskId
						? ["task"]
						: taskDoc.parentCompetitionId
							? ["competition"]
							: [],
					dueDate: taskDoc.dueDate,
				},
				view.filtersJson,
			);
			if (matches) {
				recipientIds.add(subscription.userId);
			}
			continue;
		}

		if (competitionDoc === undefined) {
			competitionDoc = await resolveCompetitionForViewSubscription(ctx, entity);
		}
		if (!competitionDoc) {
			continue;
		}

		const phaseKey = await getPhaseKey(competitionDoc.currentPhaseId);
		const compLeadName = competitionDoc.compLeadId
			? await getUserName(competitionDoc.compLeadId)
			: undefined;
		const leadDelegateName = competitionDoc.leadDelegateId
			? await getUserName(competitionDoc.leadDelegateId)
			: undefined;

		const organiserRefs = (
			await Promise.all(
				competitionDoc.organiserIds.map(async (organiserId) => {
					const name = await getUserName(organiserId);
					return name ? [organiserId, name] : [organiserId];
				}),
			)
		).flat();

		const matches = matchesCompetitionViewFilters(
			{
				phaseKeys: phaseKey ? [phaseKey] : [],
				compLeadRefs: competitionDoc.compLeadId
					? compLeadName
						? [competitionDoc.compLeadId, compLeadName]
						: [competitionDoc.compLeadId]
					: [],
				leadDelegateRefs: competitionDoc.leadDelegateId
					? leadDelegateName
						? [competitionDoc.leadDelegateId, leadDelegateName]
						: [competitionDoc.leadDelegateId]
					: [],
				organiserRefs,
				compStart: competitionDoc.compStart,
				compEnd: competitionDoc.compEnd,
			},
			view.filtersJson,
		);
		if (matches) {
			recipientIds.add(subscription.userId);
		}
	}

	return [...recipientIds];
}

async function hasUnreadBatchNotification(
	ctx: Pick<MutationCtx, "db">,
	args: {
		userId: Id<"users">;
		type: NotificationType;
		entityType: NotificationEntityType;
		entityId: string;
		batchKey: string;
	},
): Promise<boolean> {
	const docs = await ctx.db
		.query("notifications")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", args.entityType).eq("entityId", args.entityId),
		)
		.collect();

	return docs.some(
		(doc) =>
			doc.userId === args.userId &&
			doc.type === args.type &&
			doc.batchKey === args.batchKey &&
			doc.status === "unread",
	);
}

async function skipRecipient(
	ctx: MutationCtx,
	opts: {
		eventId: Id<"notificationEvents">;
		recipientId: Id<"users">;
		type: NotificationType;
		inAppStatus: DispatchStatus;
		externalStatus: DispatchStatus;
		reason: string;
		externalReason?: string;
	},
): Promise<void> {
	await upsertDispatch(ctx, {
		eventId: opts.eventId,
		userId: opts.recipientId,
		channel: IN_APP_CHANNEL,
		status: opts.inAppStatus,
		reason: opts.reason,
	});
	await upsertEnabledExternalDispatches(ctx, {
		eventId: opts.eventId,
		userId: opts.recipientId,
		type: opts.type,
		status: opts.externalStatus,
		reason: opts.externalReason ?? opts.reason,
	});
}

async function decideRecipientHandling(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		recipientId: Id<"users">;
		eventId: Id<"notificationEvents">;
		entityId: string;
		suppressActorRecipient: boolean;
	},
): Promise<RecipientDecision> {
	const existingNotification = await ctx.db
		.query("notifications")
		.withIndex("by_user_source_event", (q) =>
			q.eq("userId", args.recipientId).eq("sourceEventId", args.eventId),
		)
		.first();
	if (existingNotification) {
		return {
			kind: "existing",
			notification: existingNotification,
		};
	}

	if (
		args.suppressActorRecipient &&
		args.input.actorId &&
		args.recipientId === args.input.actorId
	) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "skipped",
				reason: "self_action",
			},
		};
	}

	const hasAccess = await canUserAccessNotificationEntity(
		ctx,
		args.recipientId,
		args.input.entity,
	);
	if (!hasAccess) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "skipped",
				reason: "no_access",
			},
		};
	}

	const inAppPreference = await getNotificationPreferenceConfig(
		ctx,
		args.recipientId,
		args.input.type,
		IN_APP_CHANNEL,
	);
	if (!inAppPreference.enabled) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "pending",
				reason: "preference_disabled",
				externalReason: "channel_not_implemented",
			},
		};
	}

	if (args.input.isBatchable && args.input.batchKey) {
		const hasExistingBatchNotification = await hasUnreadBatchNotification(ctx, {
			userId: args.recipientId,
			type: args.input.type,
			entityType: args.input.entity.entityType,
			entityId: args.entityId,
			batchKey: args.input.batchKey,
		});
		if (hasExistingBatchNotification) {
			return {
				kind: "skip",
				skip: {
					inAppStatus: "skipped",
					externalStatus: "skipped",
					reason: "batch_deduped",
				},
			};
		}
	}

	return {
		kind: "deliver",
		inAppPreference,
	};
}

async function emitInAppNotifications(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<Id<"notifications">[]> {
	const recipientSet = new Set<Id<"users">>(input.recipients);
	if (input.includeEntitySubscribers) {
		const subscribers = await getEntitySubscriberIds(ctx, input.entity);
		for (const subscriberId of subscribers) {
			recipientSet.add(subscriberId);
		}
	}
	if (input.includeViewSubscribers ?? true) {
		const viewSubscribers = await getViewSubscriberIds(ctx, input.entity);
		for (const subscriberId of viewSubscribers) {
			recipientSet.add(subscriberId);
		}
	}

	const recipients = [...recipientSet];
	if (recipients.length === 0) {
		return [];
	}

	const entityId = notificationEntityId(input.entity);
	const parentEntityId = notificationParentEntityId(input.entity);
	const threadKey = input.threadKey ?? defaultThreadKey(input.entity);
	const suppressActorRecipient = input.suppressActorRecipient ?? true;

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
			await upsertDispatch(ctx, {
				eventId,
				userId: recipientId,
				channel: IN_APP_CHANNEL,
				status: "sent",
				notificationId: decision.notification._id,
			});
			await upsertEnabledExternalDispatches(ctx, {
				eventId,
				userId: recipientId,
				type: input.type,
				status: "pending",
				reason: "channel_not_implemented",
			});
			inserted.push(decision.notification._id);
			continue;
		}

		if (decision.kind === "skip") {
			await skipRecipient(ctx, {
				eventId,
				recipientId,
				type: input.type,
				inAppStatus: decision.skip.inAppStatus,
				externalStatus: decision.skip.externalStatus,
				reason: decision.skip.reason,
				externalReason: decision.skip.externalReason,
			});
			continue;
		}

		const { inAppPreference } = decision;
		const now = Date.now();
		const timezone = await getNotificationUserTimezone(ctx, recipientId);
		const inAppSchedule = computeDispatchSchedule({
			now,
			timezone,
			digestMode: inAppPreference.digestMode,
			quietHoursStartMin: inAppPreference.quietHoursStartMin,
			quietHoursEndMin: inAppPreference.quietHoursEndMin,
		});

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

		await upsertDispatch(ctx, {
			eventId,
			userId: recipientId,
			channel: IN_APP_CHANNEL,
			status: "sent",
			notificationId,
			digestMode: inAppPreference.digestMode,
			scheduledFor: inAppSchedule.scheduledFor,
			digestWindowKey: inAppSchedule.digestWindowKey,
			metadataJson: input.payloadJson,
		});
		await upsertEnabledExternalDispatches(ctx, {
			eventId,
			userId: recipientId,
			type: input.type,
			status: "pending",
			reason: "channel_not_implemented",
		});
	}

	return inserted;
}

async function ensureSubscriptionEntityAccess(
	ctx: MutationCtx,
	userId: Id<"users">,
	entity: EntitySubscriptionArg,
): Promise<void> {
	let hasAccess = false;
	switch (entity.entityType) {
		case "task":
			hasAccess = await canUserAccessTask(ctx, userId, entity.entityId);
			break;
		case "competition":
			hasAccess = await canUserAccessCompetition(ctx, userId, entity.entityId);
			break;
		case "comment":
			hasAccess = await canUserAccessComment(ctx, userId, entity.entityId);
			break;
	}

	if (!hasAccess) {
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
		const statusBuckets = await Promise.all(
			(["unread", "read", "archived"] as const).map((status) =>
				ctx.db
					.query("notifications")
					.withIndex("by_user_and_status", (q) =>
						q.eq("userId", userId).eq("status", status),
					)
					.order("desc")
					.collect(),
			),
		);
		const docs = statusBuckets
			.flat()
			.sort((a, b) => b._creationTime - a._creationTime);
		return docs
			.filter(
				(doc) => doc.scheduledFor === undefined || doc.scheduledFor <= now,
			)
			.slice(0, limit)
			.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: {
		nowMs: v.optional(v.number()),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		void args.nowMs;
		const now = Date.now();
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();
		return docs.filter(
			(doc) =>
				(doc.snoozedUntil === undefined || doc.snoozedUntil <= now) &&
				(doc.scheduledFor === undefined || doc.scheduledFor <= now),
		).length;
	},
});

export const markRead = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId || doc.status !== "unread") {
			return null;
		}
		await ctx.db.patch("notifications", args.notificationId, {
			status: "read",
			readAt: Date.now(),
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const markArchived = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) {
			return null;
		}
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			archivedAt: Date.now(),
			readAt: doc.readAt ?? Date.now(),
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
				.filter(
					(doc) =>
						(doc.snoozedUntil === undefined || doc.snoozedUntil <= now) &&
						(doc.scheduledFor === undefined || doc.scheduledFor <= now),
				)
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

export const dismiss = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) {
			return null;
		}
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

export const snooze = mutation({
	args: {
		notificationId: v.id("notifications"),
		snoozedUntil: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId || doc.status === "archived") {
			return null;
		}

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
	args: {
		notificationId: v.id("notifications"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) {
			return null;
		}
		await ctx.db.patch("notifications", args.notificationId, {
			snoozedUntil: undefined,
		});
		return null;
	},
});

async function buildPreferenceRowsForUser(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
	userSettings?: NotificationUserSettingsResolved,
): Promise<
	Array<{
		type: NotificationType;
		channel: NotificationChannel;
		enabled: boolean;
		digestMode: NotificationDigestMode;
		respectQuietHours: boolean;
		isOverride: boolean;
		updatedAt: string;
	}>
> {
	const resolvedUserSettings =
		userSettings ?? (await getResolvedNotificationUserSettings(ctx, userId));
	const overrides = await ctx.db
		.query("notificationPreferences")
		.withIndex("by_user_type_channel", (q) => q.eq("userId", userId))
		.collect();

	const overrideMap = new Map<string, Doc<"notificationPreferences">>();
	for (const override of overrides) {
		overrideMap.set(`${override.type}:${override.channel}`, override);
	}

	const preferences: Array<{
		type: NotificationType;
		channel: NotificationChannel;
		enabled: boolean;
		digestMode: NotificationDigestMode;
		respectQuietHours: boolean;
		isOverride: boolean;
		updatedAt: string;
	}> = [];

	for (const type of NOTIFICATION_TYPES) {
		for (const channel of SUPPORTED_NOTIFICATION_CHANNELS) {
			const key = `${type}:${channel}`;
			const override = overrideMap.get(key);
			const isOverride = override !== undefined;
			const digestMode =
				channel === IN_APP_CHANNEL
					? isOverride
						? "immediate"
						: resolvedUserSettings.defaultDigestMode
					: (override?.digestMode ?? resolvedUserSettings.defaultDigestMode);
			preferences.push({
				type,
				channel,
				enabled: override?.enabled ?? defaultChannelEnabled(channel),
				digestMode,
				respectQuietHours: override?.respectQuietHours ?? true,
				isOverride,
				updatedAt: override
					? toISO(override.updatedAt)
					: toISO(resolvedUserSettings.updatedAt),
			});
		}
	}

	return preferences;
}

async function upsertNotificationPreferenceOverride(
	ctx: MutationCtx,
	args: {
		userId: Id<"users">;
		type: NotificationType;
		channel: NotificationChannel;
		enabled?: boolean;
		digestMode?: NotificationDigestMode;
		respectQuietHours?: boolean;
		clearOverride?: boolean;
		defaultDigestMode?: NotificationDigestMode;
	},
): Promise<void> {
	assertSupportedChannel(args.channel);
	const existing = await ctx.db
		.query("notificationPreferences")
		.withIndex("by_user_type_channel", (q) =>
			q
				.eq("userId", args.userId)
				.eq("type", args.type)
				.eq("channel", args.channel),
		)
		.first();

	if (args.clearOverride) {
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		return;
	}

	const respectQuietHours =
		args.respectQuietHours ?? existing?.respectQuietHours ?? true;

	const fallbackDigestMode = args.defaultDigestMode ?? DEFAULT_DIGEST_MODE;
	const digestMode =
		args.channel === IN_APP_CHANNEL
			? "immediate"
			: (args.digestMode ?? existing?.digestMode ?? fallbackDigestMode);
	const enabled =
		args.enabled ?? existing?.enabled ?? defaultChannelEnabled(args.channel);

	const now = Date.now();
	if (existing) {
		await ctx.db.patch(existing._id, {
			enabled,
			digestMode,
			respectQuietHours,
			updatedAt: now,
		});
		return;
	}

	await ctx.db.insert("notificationPreferences", {
		userId: args.userId,
		type: args.type,
		channel: args.channel,
		enabled,
		digestMode,
		respectQuietHours,
		updatedAt: now,
	});
}

export const getUserSettings = query({
	args: {},
	returns: notificationUserSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const settings = await getResolvedNotificationUserSettings(ctx, userId);
		return {
			timezone: settings.timezone,
			defaultDigestMode: settings.defaultDigestMode,
			quietHoursStartMin: settings.quietHoursStartMin,
			quietHoursEndMin: settings.quietHoursEndMin,
			updatedAt: toISO(settings.updatedAt),
		};
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
		await upsertNotificationUserSettings(ctx, userId, {
			timezone: args.timezone,
			defaultDigestMode: args.defaultDigestMode,
			quietHoursStartMin: args.quietHoursStartMin,
			quietHoursEndMin: args.quietHoursEndMin,
			clearQuietHours: args.clearQuietHours,
		});
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
		return {
			timezone: userSettings.timezone,
			defaultDigestMode: userSettings.defaultDigestMode,
			quietHoursStartMin: userSettings.quietHoursStartMin,
			quietHoursEndMin: userSettings.quietHoursEndMin,
			preferences,
		};
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
		if (
			args.timezone !== undefined ||
			args.defaultDigestMode !== undefined ||
			args.quietHoursStartMin !== undefined ||
			args.quietHoursEndMin !== undefined ||
			args.clearQuietHours
		) {
			await upsertNotificationUserSettings(ctx, userId, {
				timezone: args.timezone,
				defaultDigestMode: args.defaultDigestMode,
				quietHoursStartMin: args.quietHoursStartMin,
				quietHoursEndMin: args.quietHoursEndMin,
				clearQuietHours: args.clearQuietHours,
			});
		}

		if (!args.preferences || args.preferences.length === 0) {
			return null;
		}

		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		for (const preference of args.preferences) {
			await upsertNotificationPreferenceOverride(ctx, {
				userId,
				type: preference.type,
				channel: preference.channel,
				enabled: preference.enabled,
				digestMode: preference.digestMode,
				respectQuietHours: preference.respectQuietHours,
				clearOverride: preference.clearOverride,
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
			type: args.type,
			channel: args.channel,
			enabled: args.enabled,
			digestMode: args.digestMode,
			respectQuietHours: args.respectQuietHours,
			clearOverride: args.clearOverride,
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

function staleSubscriptionPresentation(
	label: string,
	description: string,
): SubscriptionPresentation {
	return {
		label,
		description,
		isStale: true,
	};
}

async function describeTaskSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityId: string,
): Promise<SubscriptionPresentation> {
	const taskId = ctx.db.normalizeId("tasks", entityId);
	if (!taskId) {
		return staleSubscriptionPresentation("Deleted task", "Task");
	}

	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		return staleSubscriptionPresentation("Deleted task", "Task");
	}

	const hasAccess = await canUserAccessTask(ctx, userId, taskId);
	if (!hasAccess) {
		return staleSubscriptionPresentation("Restricted task", "Task");
	}

	return {
		label: `${task.identifier}: ${task.title}`,
		description: "Task",
		isStale: false,
	};
}

async function describeCompetitionSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityId: string,
): Promise<SubscriptionPresentation> {
	const competitionId = ctx.db.normalizeId("competitions", entityId);
	if (!competitionId) {
		return staleSubscriptionPresentation("Deleted competition", "Competition");
	}

	const competition = await ctx.db.get("competitions", competitionId);
	if (!competition) {
		return staleSubscriptionPresentation("Deleted competition", "Competition");
	}

	const hasAccess = await canUserAccessCompetition(ctx, userId, competitionId);
	if (!hasAccess) {
		return staleSubscriptionPresentation(
			"Restricted competition",
			"Competition",
		);
	}

	return {
		label: competition.name,
		description: "Competition",
		isStale: false,
	};
}

async function describeCommentSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityId: string,
): Promise<SubscriptionPresentation> {
	const commentId = ctx.db.normalizeId("comments", entityId);
	if (!commentId) {
		return staleSubscriptionPresentation("Deleted comment", "Comment");
	}

	const comment = await ctx.db.get("comments", commentId);
	if (!comment) {
		return staleSubscriptionPresentation("Deleted comment", "Comment");
	}

	const hasAccess = await canUserAccessComment(ctx, userId, commentId);
	if (!hasAccess) {
		return staleSubscriptionPresentation("Restricted comment", "Comment");
	}

	if (comment.parentType === "task") {
		const taskId = getCommentParentId("task", comment.parentId);
		const task = await ctx.db.get("tasks", taskId);
		if (task) {
			return {
				label: `Comment on ${task.identifier}`,
				description: "Task comment",
				isStale: false,
			};
		}
		return staleSubscriptionPresentation(
			"Comment on deleted task",
			"Task comment",
		);
	}

	const updateId = getCommentParentId("update", comment.parentId);
	const update = await ctx.db.get("competitionUpdates", updateId);
	if (!update) {
		return staleSubscriptionPresentation(
			"Comment on deleted update",
			"Competition update comment",
		);
	}
	const competition = await ctx.db.get("competitions", update.competitionId);
	return {
		label: competition
			? `Comment on ${competition.name}`
			: "Comment on competition update",
		description: "Competition update comment",
		isStale: competition === null,
	};
}

async function describeViewSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	viewId: Id<"savedViews"> | undefined,
): Promise<SubscriptionPresentation> {
	if (!viewId) {
		return staleSubscriptionPresentation("Deleted view", "Saved view");
	}

	const view = await ctx.db.get("savedViews", viewId);
	if (!view || view.userId !== userId) {
		return staleSubscriptionPresentation("Deleted view", "Saved view");
	}

	return {
		label: view.name,
		description:
			view.entity === "tasks"
				? `Task view (${view.pageId})`
				: `Competition view (${view.pageId})`,
		isStale: false,
	};
}

async function describeSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	subscription: Doc<"notificationSubscriptions">,
): Promise<SubscriptionPresentation> {
	if (subscription.subscriptionType === "view") {
		return describeViewSubscription(ctx, userId, subscription.viewId);
	}

	if (!subscription.entityType || !subscription.entityId) {
		return staleSubscriptionPresentation("Invalid subscription", "Entity");
	}

	switch (subscription.entityType) {
		case "task":
			return describeTaskSubscription(ctx, userId, subscription.entityId);
		case "competition":
			return describeCompetitionSubscription(
				ctx,
				userId,
				subscription.entityId,
			);
		case "comment":
			return describeCommentSubscription(ctx, userId, subscription.entityId);
	}
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
				const presentation = await describeSubscription(ctx, userId, doc);
				return {
					id: doc._id,
					subscriptionType: doc.subscriptionType,
					entityType: doc.entityType,
					entityId: doc.entityId,
					viewId: doc.viewId,
					viewEntity: doc.viewEntity,
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

export const isSubscribedToEntity = query({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const entityId = `${args.entity.entityId}`;
		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_entity", (q) =>
				q
					.eq("userId", userId)
					.eq("entityType", args.entity.entityType)
					.eq("entityId", entityId),
			)
			.first();
		if (!existing) {
			return false;
		}

		switch (args.entity.entityType) {
			case "task":
				return canUserAccessTask(ctx, userId, args.entity.entityId);
			case "competition":
				return canUserAccessCompetition(ctx, userId, args.entity.entityId);
			case "comment":
				return canUserAccessComment(ctx, userId, args.entity.entityId);
		}
	},
});

export const isSubscribedToView = query({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const view = await ctx.db.get("savedViews", args.viewId);
		if (!view || view.userId !== userId) {
			return false;
		}
		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_view", (q) =>
				q.eq("userId", userId).eq("viewId", args.viewId),
			)
			.first();
		return existing !== null;
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
		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_entity", (q) =>
				q
					.eq("userId", userId)
					.eq("entityType", args.entity.entityType)
					.eq("entityId", entityId),
			)
			.first();
		if (existing) {
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			subscriptionType: "entity",
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
		const entityId = `${args.entity.entityId}`;
		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_entity", (q) =>
				q
					.eq("userId", userId)
					.eq("entityType", args.entity.entityType)
					.eq("entityId", entityId),
			)
			.first();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		return null;
	},
});

export const subscribeToView = mutation({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.id("notificationSubscriptions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const view = await ctx.db.get("savedViews", args.viewId);
		if (!view || view.userId !== userId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to this view",
			});
		}

		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_view", (q) =>
				q.eq("userId", userId).eq("viewId", args.viewId),
			)
			.first();
		if (existing) {
			if (existing.viewEntity !== view.entity) {
				await ctx.db.patch(existing._id, {
					viewEntity: view.entity,
					updatedAt: Date.now(),
				});
			}
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			subscriptionType: "view",
			viewId: args.viewId,
			viewEntity: view.entity,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromView = mutation({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_view", (q) =>
				q.eq("userId", userId).eq("viewId", args.viewId),
			)
			.first();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
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
		const userId = await requireUserId(ctx);
		const [pending, sent, skipped, failed] = await Promise.all([
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", userId).eq("status", "pending"),
				)
				.collect(),
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", userId).eq("status", "sent"),
				)
				.collect(),
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", userId).eq("status", "skipped"),
				)
				.collect(),
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", userId).eq("status", "failed"),
				)
				.collect(),
		]);
		return {
			pending: pending.length,
			sent: sent.length,
			skipped: skipped.length,
			failed: failed.length,
		};
	},
});

async function getActorInfo(
	ctx: Pick<MutationCtx, "db">,
	actorId: Id<"users"> | null | undefined,
): Promise<{
	actorId?: Id<"users">;
	actorName?: string;
	actorAvatarUrl?: string;
}> {
	if (!actorId) return {};
	const user = await ctx.db.get("users", actorId);
	if (!user) return {};
	return {
		actorId,
		actorName: user.name ?? undefined,
		actorAvatarUrl: user.image ?? undefined,
	};
}

type TaskNotificationBuildArgs = {
	taskId: Id<"tasks">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	actorId: Id<"users">;
	commentId?: Id<"comments">;
	oldStatus?: string;
	newStatus?: string;
	oldPriority?: string;
	newPriority?: string;
	blockingTaskId?: Id<"tasks">;
	eventKey?: string;
};

type TaskNotificationBuildResult = {
	config: NotificationTemplateConfig;
	entity: NotificationEntityRef;
	payload: NotificationPayload;
};

type CompetitionProgressStatus = "on-track" | "at-risk" | "off-track";

type CompetitionNotificationBuildArgs = {
	type: "competition_phase_changed" | "progress_update_added";
	competitionId: Id<"competitions">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	actorId: Id<"users">;
	oldPhaseName?: string;
	newPhaseName?: string;
	competitionName?: string;
	status?: CompetitionProgressStatus;
	eventKey?: string;
};

type CompetitionNotificationBuildResult = {
	config: NotificationTemplateConfig;
	payload: NotificationPayload;
};

function resolveRecipientIds(args: {
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
}): Id<"users">[] {
	const recipientSet = new Set<Id<"users">>();
	if (args.recipientId) {
		recipientSet.add(args.recipientId);
	}
	if (args.recipientIds) {
		for (const recipientId of args.recipientIds) {
			recipientSet.add(recipientId);
		}
	}
	return [...recipientSet];
}

function buildCommentEntity(
	taskId: Id<"tasks">,
	commentId: Id<"comments">,
): NotificationEntityRef {
	return {
		entityType: "comment",
		entityId: commentId,
		parentTaskId: taskId,
	};
}

async function buildTaskNotificationResult(
	ctx: MutationCtx,
	type: TaskNotificationType,
	task: Doc<"tasks">,
	actor: Awaited<ReturnType<typeof getActorInfo>>,
	args: TaskNotificationBuildArgs,
	basePayload: NotificationPayload,
): Promise<TaskNotificationBuildResult | null> {
	if (type === "task_assigned") {
		return {
			config: NotificationTemplates.task_assigned(task, actor),
			entity: { entityType: "task", entityId: task._id },
			payload: basePayload,
		};
	}

	if (type === "task_unassigned") {
		return {
			config: NotificationTemplates.task_unassigned(task, actor),
			entity: { entityType: "task", entityId: task._id },
			payload: basePayload,
		};
	}

	if (
		type === "task_mentioned" ||
		type === "comment_added" ||
		type === "comment_replied"
	) {
		if (!args.commentId) {
			return null;
		}
		let config: NotificationTemplateConfig;
		if (type === "task_mentioned") {
			config = NotificationTemplates.task_mentioned(task, actor);
		} else if (type === "comment_replied") {
			config = NotificationTemplates.comment_replied(task, actor);
		} else {
			config = NotificationTemplates.comment_added(task, actor);
		}
		return {
			config,
			entity: buildCommentEntity(task._id, args.commentId),
			payload: {
				...basePayload,
				commentId: args.commentId,
			},
		};
	}

	if (type === "task_status_changed") {
		if (args.oldStatus === undefined || args.newStatus === undefined) {
			return null;
		}
		return {
			config: NotificationTemplates.task_status_changed(
				task,
				actor,
				args.oldStatus,
				args.newStatus,
			),
			entity: { entityType: "task", entityId: task._id },
			payload: {
				...basePayload,
				oldStatus: args.oldStatus,
				newStatus: args.newStatus,
			},
		};
	}

	if (type === "task_priority_changed") {
		if (args.oldPriority === undefined || args.newPriority === undefined) {
			return null;
		}
		return {
			config: NotificationTemplates.task_priority_changed(
				task,
				actor,
				args.oldPriority,
				args.newPriority,
			),
			entity: { entityType: "task", entityId: task._id },
			payload: {
				...basePayload,
				oldPriority: args.oldPriority,
				newPriority: args.newPriority,
			},
		};
	}

	if (type === "task_awaiting_review") {
		return {
			config: NotificationTemplates.task_awaiting_review(task, actor),
			entity: { entityType: "task", entityId: task._id },
			payload: basePayload,
		};
	}

	if (type === "relation_blocked" || type === "relation_unblocked") {
		if (!args.blockingTaskId) {
			return null;
		}
		const blockingTask = await ctx.db.get("tasks", args.blockingTaskId);
		if (!blockingTask) {
			return null;
		}
		const config =
			type === "relation_blocked"
				? NotificationTemplates.relation_blocked(task, blockingTask, actor)
				: NotificationTemplates.relation_unblocked(task, blockingTask, actor);
		return {
			config,
			entity: { entityType: "task", entityId: task._id },
			payload: {
				...basePayload,
				blockingTaskId: args.blockingTaskId,
			},
		};
	}

	return null;
}

async function createTaskNotification(
	ctx: MutationCtx,
	type: TaskNotificationType,
	args: TaskNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) {
		return null;
	}

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;

	const basePayload: NotificationPayload = {
		type,
		taskId: task._id,
		eventKey,
	};
	const result = await buildTaskNotificationResult(
		ctx,
		type,
		task,
		actor,
		args,
		basePayload,
	);

	if (!result) {
		return null;
	}
	const recipients = resolveRecipientIds(args);
	const isTargetedCommentNotification =
		type === "task_mentioned" || type === "comment_replied";

	const inserted = await emitInAppNotifications(ctx, {
		type,
		entity: result.entity,
		recipients,
		actorId: args.actorId,
		title: result.config.title,
		message: result.config.message,
		priority: result.config.priority,
		metadata: result.config.metadata,
		body: result.config.body,
		isBatchable: result.config.isBatchable,
		batchKey: result.config.batchKey,
		idempotencyBase: `${type}:${task._id}:${task.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		includeEntitySubscribers: !isTargetedCommentNotification,
		includeViewSubscribers: !isTargetedCommentNotification,
	});

	return inserted[0] ?? null;
}

async function createCompetitionNotification(
	ctx: MutationCtx,
	args: CompetitionNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const competition = await ctx.db.get("competitions", args.competitionId);
	if (!competition) {
		return null;
	}

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const basePayload: NotificationPayload = {
		type: args.type,
		competitionId: args.competitionId,
		eventKey,
	};
	const result = buildCompetitionNotificationResult(
		competition,
		actor,
		args,
		basePayload,
	);
	if (!result) {
		return null;
	}
	const recipients = resolveRecipientIds(args);

	const inserted = await emitInAppNotifications(ctx, {
		type: args.type,
		entity: {
			entityType: "competition",
			entityId: competition._id,
		},
		recipients,
		actorId: args.actorId,
		title: result.config.title,
		message: result.config.message,
		priority: result.config.priority,
		metadata: result.config.metadata,
		idempotencyBase: `${args.type}:${competition._id}:${competition.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		includeEntitySubscribers: true,
	});

	return inserted[0] ?? null;
}

function buildCompetitionNotificationResult(
	competition: Doc<"competitions">,
	actor: Awaited<ReturnType<typeof getActorInfo>>,
	args: CompetitionNotificationBuildArgs,
	basePayload: NotificationPayload,
): CompetitionNotificationBuildResult | null {
	if (args.type === "competition_phase_changed") {
		if (!args.oldPhaseName || !args.newPhaseName) {
			return null;
		}
		return {
			config: NotificationTemplates.competition_phase_changed(
				competition,
				actor,
				args.oldPhaseName,
				args.newPhaseName,
			),
			payload: {
				...basePayload,
				oldPhaseName: args.oldPhaseName,
				newPhaseName: args.newPhaseName,
			},
		};
	}

	if (!args.competitionName || !args.status) {
		return null;
	}
	return {
		config: NotificationTemplates.progress_update_added(
			{ _id: competition._id, name: args.competitionName },
			actor,
			args.status,
		),
		payload: {
			...basePayload,
			competitionName: args.competitionName,
			status: args.status,
		},
	};
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
	if (!reminder) {
		return null;
	}

	const eventKey = args.eventKey ?? `${Date.now()}`;
	const config = NotificationTemplates.reminder_triggered(
		args.taskId,
		args.message,
	);

	const inserted = await emitInAppNotifications(ctx, {
		type: "reminder_triggered",
		entity: {
			entityType: "reminder",
			entityId: reminder._id,
			parentTaskId: args.taskId,
		},
		recipients: [args.userId],
		title: config.title,
		message: config.message,
		priority: config.priority,
		metadata: config.metadata,
		idempotencyBase: `reminder_triggered:${reminder._id}:${eventKey}`,
		payloadJson: serializePayload({
			reminderId: reminder._id,
			taskId: args.taskId,
			eventKey,
		}),
		includeEntitySubscribers: false,
		includeViewSubscribers: false,
		suppressActorRecipient: false,
	});

	return inserted[0] ?? null;
}

export const _notifyTaskAssigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_assigned", {
			taskId: args.taskId,
			recipientId: args.assigneeId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskUnassigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_unassigned", {
			taskId: args.taskId,
			recipientId: args.assigneeId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskMentioned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		mentionedUserId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_mentioned", {
			taskId: args.taskId,
			commentId: args.commentId,
			recipientId: args.mentionedUserId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyCommentAdded = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "comment_added", {
			taskId: args.taskId,
			commentId: args.commentId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyCommentReplied = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "comment_replied", {
			taskId: args.taskId,
			commentId: args.commentId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskStatusChanged = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		oldStatus: v.string(),
		newStatus: v.string(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_status_changed", {
			taskId: args.taskId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			oldStatus: args.oldStatus,
			newStatus: args.newStatus,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskPriorityChanged = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		oldPriority: v.string(),
		newPriority: v.string(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_priority_changed", {
			taskId: args.taskId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			oldPriority: args.oldPriority,
			newPriority: args.newPriority,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskAwaitingReview = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_awaiting_review", {
			taskId: args.taskId,
			recipientId: args.recipientId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskRelationBlocked = internalMutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_blocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskRelationUnblocked = internalMutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_unblocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyDueDateApproaching = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysUntil: v.number(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task?.dueDate) return null;

		const config = NotificationTemplates.due_date_approaching(
			task,
			args.daysUntil,
		);
		const eventKey = args.eventKey ?? `${Date.now()}`;
		const inserted = await emitInAppNotifications(ctx, {
			type: "due_date_approaching",
			entity: { entityType: "task", entityId: task._id },
			recipients: [args.assigneeId],
			title: config.title,
			message: config.message,
			priority: config.priority,
			metadata: config.metadata,
			isBatchable: config.isBatchable,
			batchKey: config.batchKey,
			idempotencyBase: `due_date_approaching:${task._id}:${args.daysUntil}:${eventKey}`,
			payloadJson: serializePayload({
				taskId: task._id,
				daysUntil: args.daysUntil,
				eventKey,
			}),
			includeEntitySubscribers: true,
		});
		return inserted[0] ?? null;
	},
});

export const _notifyDueDateOverdue = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysOverdue: v.number(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task?.dueDate) return null;

		const config = NotificationTemplates.due_date_overdue(
			task,
			args.daysOverdue,
		);
		const eventKey = args.eventKey ?? `${Date.now()}`;
		const inserted = await emitInAppNotifications(ctx, {
			type: "due_date_overdue",
			entity: { entityType: "task", entityId: task._id },
			recipients: [args.assigneeId],
			title: config.title,
			message: config.message,
			priority: config.priority,
			metadata: config.metadata,
			isBatchable: config.isBatchable,
			batchKey: config.batchKey,
			idempotencyBase: `due_date_overdue:${task._id}:${args.daysOverdue}:${eventKey}`,
			payloadJson: serializePayload({
				taskId: task._id,
				daysOverdue: args.daysOverdue,
				eventKey,
			}),
			includeEntitySubscribers: true,
		});
		return inserted[0] ?? null;
	},
});

export const _notifyCompetitionPhaseChanged = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		oldPhaseName: v.string(),
		newPhaseName: v.string(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createCompetitionNotification(ctx, {
			type: "competition_phase_changed",
			competitionId: args.competitionId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			oldPhaseName: args.oldPhaseName,
			newPhaseName: args.newPhaseName,
			eventKey: args.eventKey,
		}),
});

export const _notifyProgressUpdateAdded = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		competitionName: v.string(),
		status: v.union(
			v.literal("on-track"),
			v.literal("at-risk"),
			v.literal("off-track"),
		),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createCompetitionNotification(ctx, {
			type: "progress_update_added",
			competitionId: args.competitionId,
			recipientId: args.recipientId,
			recipientIds: args.recipientIds,
			actorId: args.actorId,
			competitionName: args.competitionName,
			status: args.status,
			eventKey: args.eventKey,
		}),
});

export const _notifyReminderTriggered = internalMutation({
	args: {
		reminderId: v.id("reminders"),
		userId: v.id("users"),
		taskId: v.id("tasks"),
		message: v.optional(v.string()),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createReminderNotification(ctx, {
			reminderId: args.reminderId,
			userId: args.userId,
			taskId: args.taskId,
			message: args.message,
			eventKey: args.eventKey,
		}),
});

function normalizeDispatchBatchLimit(limit: number | undefined): number {
	if (!limit || Number.isNaN(limit)) {
		return NOTIFICATION_DEFAULTS.MAX_DISPATCH_BATCH_SIZE;
	}
	if (limit < 1) {
		return 1;
	}
	return Math.min(limit, NOTIFICATION_DEFAULTS.MAX_DISPATCH_BATCH_SIZE);
}

export const _processPendingDispatches = internalMutation({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const limit = normalizeDispatchBatchLimit(args.limit);
		const pendingDispatches = await ctx.db
			.query("notificationDispatches")
			.withIndex("by_status_scheduled_for", (q) =>
				q.eq("status", "pending").lte("scheduledFor", now),
			)
			.take(limit);

		if (pendingDispatches.length === 0) {
			return 0;
		}

		const dispatchGroups = new Map<string, Doc<"notificationDispatches">[]>();
		for (const dispatch of pendingDispatches) {
			const digestKey =
				dispatch.digestMode === "immediate"
					? `${dispatch.userId}:${dispatch.channel}:${dispatch._id}`
					: `${dispatch.userId}:${dispatch.channel}:${dispatch.digestMode}:${dispatch.digestWindowKey ?? "windowless"}`;
			const existingGroup = dispatchGroups.get(digestKey) ?? [];
			existingGroup.push(dispatch);
			dispatchGroups.set(digestKey, existingGroup);
		}

		let processedCount = 0;
		for (const dispatchGroup of dispatchGroups.values()) {
			const eventIds = [...new Set(dispatchGroup.map((d) => d.eventId))];
			const metadataJson = JSON.stringify({
				mode: dispatchGroup[0]?.digestMode ?? "immediate",
				channel: dispatchGroup[0]?.channel,
				eventCount: eventIds.length,
				eventIds,
				digestWindowKey: dispatchGroup[0]?.digestWindowKey,
				processedAt: now,
			});

			await Promise.all(
				dispatchGroup.map((dispatch) =>
					ctx.db.patch(dispatch._id, {
						status: "skipped",
						reason: "channel_not_implemented",
						metadataJson,
						attempts: dispatch.attempts + 1,
						lastAttemptAt: now,
						updatedAt: now,
					}),
				),
			);

			processedCount += dispatchGroup.length;
		}

		return processedCount;
	},
});

const { APPROACHING_MS: APPROACHING_THRESHOLD_MS, MS_PER_DAY } =
	NOTIFICATION_THRESHOLDS;

type DueDateNotificationType = "due_date_overdue" | "due_date_approaching";

type DueDateNotificationSpec = {
	type: DueDateNotificationType;
	config: NotificationTemplateConfig;
	idempotencyBase: string;
	payload: NotificationPayload;
};

function buildDueDateNotificationSpec(
	task: Doc<"tasks">,
	diffMs: number,
	daysDiff: number,
	dayBucket: number,
): DueDateNotificationSpec | null {
	if (diffMs < 0) {
		const daysOverdue = Math.abs(daysDiff);
		return {
			type: "due_date_overdue",
			config: NotificationTemplates.due_date_overdue(task, daysOverdue),
			idempotencyBase: `due_date_overdue:${task._id}:${daysOverdue}:${dayBucket}`,
			payload: {
				taskId: task._id,
				daysOverdue,
				dayBucket,
			},
		};
	}

	if (diffMs > 0 && diffMs <= APPROACHING_THRESHOLD_MS) {
		return {
			type: "due_date_approaching",
			config: NotificationTemplates.due_date_approaching(task, daysDiff),
			idempotencyBase: `due_date_approaching:${task._id}:${daysDiff}:${dayBucket}`,
			payload: {
				taskId: task._id,
				daysDiff,
				dayBucket,
			},
		};
	}

	return null;
}

async function emitDueDateNotification(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	recipientId: Id<"users">,
	spec: DueDateNotificationSpec,
): Promise<number> {
	const inserted = await emitInAppNotifications(ctx, {
		type: spec.type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [recipientId],
		title: spec.config.title,
		message: spec.config.message,
		priority: spec.config.priority,
		metadata: spec.config.metadata,
		isBatchable: spec.config.isBatchable,
		batchKey: spec.config.batchKey,
		idempotencyBase: spec.idempotencyBase,
		payloadJson: serializePayload(spec.payload),
		includeEntitySubscribers: true,
	});
	return inserted.length;
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
			if (!task.dueDate || !task.assigneeId || task.status === "done") {
				continue;
			}

			const dueDateMs = new Date(task.dueDate).getTime();
			const diffMs = dueDateMs - now;
			const daysDiff = Math.floor(diffMs / MS_PER_DAY);
			const dayBucket = Math.floor(now / MS_PER_DAY);
			const spec = buildDueDateNotificationSpec(
				task,
				diffMs,
				daysDiff,
				dayBucket,
			);
			if (!spec) {
				continue;
			}
			notificationCount += await emitDueDateNotification(
				ctx,
				task,
				task.assigneeId,
				spec,
			);
		}

		return notificationCount;
	},
});
