import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";
import type { Infer } from "convex/values";
import { hasCompetitionAccess } from "./competitionAccess";
import { getCommentParentId } from "./lib/commentParentId";
import {
	NOTIFICATION_CHANNELS,
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
import { NOTIFICATION_THRESHOLDS } from "./lib/constants";

const toISO = (ms: number) => new Date(ms).toISOString();
const IN_APP_CHANNEL: NotificationChannel = "in_app";
const EXTERNAL_NOTIFICATION_CHANNELS: NotificationChannel[] = [
	"email",
	"slack",
	"push",
];
const DEFAULT_DIGEST_MODE: NotificationDigestMode = "immediate";
const DEFAULT_LIST_LIMIT = 250;
const MAX_LIST_LIMIT = 500;

type NotificationMetadata = Infer<typeof notificationMetadata>;
type NotificationType = Infer<typeof notificationType>;
type NotificationPriority = Infer<typeof notificationPriority>;
type NotificationChannel = Infer<typeof notificationChannel>;
type NotificationDigestMode = Infer<typeof notificationDigestMode>;
type NotificationSubscriberEntityType = Infer<
	typeof notificationSubscriberEntityType
>;
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
	quietHoursStartMin: v.optional(v.number()),
	quietHoursEndMin: v.optional(v.number()),
	updatedAt: v.string(),
});

const notificationSubscriptionReturns = v.object({
	id: v.id("notificationSubscriptions"),
	subscriptionType: notificationSubscriptionType,
	entityType: v.optional(notificationSubscriberEntityType),
	entityId: v.optional(v.string()),
	viewId: v.optional(v.string()),
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
	suppressActorRecipient?: boolean;
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
		return DEFAULT_LIST_LIMIT;
	}
	if (limit < 1) {
		return 1;
	}
	if (limit > MAX_LIST_LIMIT) {
		return MAX_LIST_LIMIT;
	}
	return limit;
}

function validateQuietHour(value: number | undefined, fieldName: string): void {
	if (value === undefined) return;
	if (!Number.isInteger(value) || value < 0 || value > 1439) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${fieldName} must be an integer between 0 and 1439`,
		});
	}
}

function serializePayload(
	payload: Record<string, string | number | boolean | null | undefined>,
): string | undefined {
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

function defaultChannelEnabled(channel: NotificationChannel): boolean {
	return channel === IN_APP_CHANNEL;
}

async function isNotificationChannelEnabled(
	ctx: Pick<MutationCtx, "db">,
	userId: Id<"users">,
	type: NotificationType,
	channel: NotificationChannel,
): Promise<boolean> {
	const override = await ctx.db
		.query("notificationPreferences")
		.withIndex("by_user_type_channel", (q) =>
			q.eq("userId", userId).eq("type", type).eq("channel", channel),
		)
		.first();
	return override?.enabled ?? defaultChannelEnabled(channel);
}

async function isInAppNotificationEnabled(
	ctx: Pick<MutationCtx, "db">,
	userId: Id<"users">,
	type: NotificationType,
): Promise<boolean> {
	return isNotificationChannelEnabled(ctx, userId, type, IN_APP_CHANNEL);
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
	const enabledChannels = (
		await Promise.all(
			EXTERNAL_NOTIFICATION_CHANNELS.map(async (channel) => {
				const enabled = await isNotificationChannelEnabled(
					ctx,
					args.userId,
					args.type,
					channel,
				);
				return enabled ? channel : null;
			}),
		)
	).filter((channel): channel is NotificationChannel => channel !== null);

	await Promise.all(
		enabledChannels.map((channel) =>
			upsertDispatch(ctx, {
				eventId: args.eventId,
				userId: args.userId,
				channel,
				status: args.status,
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

	if (existing) {
		await ctx.db.patch(existing._id, {
			notificationId: args.notificationId ?? existing.notificationId,
			status: args.status,
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

	return hasCompetitionAccess(
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
		return canUserAccessTask(ctx, userId, getCommentParentId("task", comment.parentId));
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
		const dedupeKey = input.dedupeKey ?? `${input.type}:${threadKey}:${recipientId}`;

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

		const existingNotification = await ctx.db
			.query("notifications")
			.withIndex("by_user_source_event", (q) =>
				q.eq("userId", recipientId).eq("sourceEventId", eventId),
			)
			.first();
			if (existingNotification) {
				await upsertDispatch(ctx, {
					eventId,
					userId: recipientId,
					channel: IN_APP_CHANNEL,
					status: "sent",
					notificationId: existingNotification._id,
				});
				await upsertEnabledExternalDispatches(ctx, {
					eventId,
					userId: recipientId,
					type: input.type,
					status: "pending",
					reason: "channel_not_implemented",
				});
				inserted.push(existingNotification._id);
				continue;
			}

			if (suppressActorRecipient && input.actorId && recipientId === input.actorId) {
			await upsertDispatch(ctx, {
				eventId,
				userId: recipientId,
					channel: IN_APP_CHANNEL,
					status: "skipped",
					reason: "self_action",
				});
				await upsertEnabledExternalDispatches(ctx, {
					eventId,
					userId: recipientId,
					type: input.type,
					status: "skipped",
					reason: "self_action",
				});
				continue;
			}

		const hasAccess = await canUserAccessNotificationEntity(
			ctx,
			recipientId,
			input.entity,
		);
		if (!hasAccess) {
			await upsertDispatch(ctx, {
				eventId,
				userId: recipientId,
					channel: IN_APP_CHANNEL,
					status: "skipped",
					reason: "no_access",
				});
				await upsertEnabledExternalDispatches(ctx, {
					eventId,
					userId: recipientId,
					type: input.type,
					status: "skipped",
					reason: "no_access",
				});
				continue;
			}

		const enabled = await isInAppNotificationEnabled(
			ctx,
			recipientId,
			input.type,
		);
		if (!enabled) {
			await upsertDispatch(ctx, {
				eventId,
				userId: recipientId,
					channel: IN_APP_CHANNEL,
					status: "skipped",
					reason: "preference_disabled",
				});
				await upsertEnabledExternalDispatches(ctx, {
					eventId,
					userId: recipientId,
					type: input.type,
					status: "pending",
					reason: "channel_not_implemented",
				});
				continue;
			}

		if (input.isBatchable && input.batchKey) {
			const hasExistingBatchNotification = await hasUnreadBatchNotification(ctx, {
				userId: recipientId,
				type: input.type,
				entityType: input.entity.entityType,
				entityId,
				batchKey: input.batchKey,
			});
			if (hasExistingBatchNotification) {
				await upsertDispatch(ctx, {
					eventId,
					userId: recipientId,
						channel: IN_APP_CHANNEL,
						status: "skipped",
						reason: "batch_deduped",
					});
					await upsertEnabledExternalDispatches(ctx, {
						eventId,
						userId: recipientId,
						type: input.type,
						status: "skipped",
						reason: "batch_deduped",
					});
					continue;
				}
			}

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
			scheduledFor: undefined,
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
	},
	returns: v.array(notificationReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeListLimit(args.limit);
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.take(limit);
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();
		return docs.filter(
			(doc) => doc.snoozedUntil === undefined || doc.snoozedUntil <= now,
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
					(doc) => doc.snoozedUntil === undefined || doc.snoozedUntil <= now,
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

export const listPreferences = query({
	args: {},
	returns: v.array(notificationPreferenceReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const overrides = await ctx.db
			.query("notificationPreferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		const overrideMap = new Map<string, Doc<"notificationPreferences">>();
		for (const override of overrides) {
			overrideMap.set(`${override.type}:${override.channel}`, override);
		}

		const nowIso = toISO(0);
		const preferences: Array<{
			type: NotificationType;
			channel: NotificationChannel;
			enabled: boolean;
			digestMode: NotificationDigestMode;
			quietHoursStartMin?: number;
			quietHoursEndMin?: number;
			updatedAt: string;
		}> = [];

		for (const type of NOTIFICATION_TYPES) {
			for (const channel of NOTIFICATION_CHANNELS) {
				const key = `${type}:${channel}`;
				const override = overrideMap.get(key);
				preferences.push({
					type,
					channel,
					enabled: override?.enabled ?? defaultChannelEnabled(channel),
					digestMode: override?.digestMode ?? DEFAULT_DIGEST_MODE,
					quietHoursStartMin: override?.quietHoursStartMin,
					quietHoursEndMin: override?.quietHoursEndMin,
					updatedAt: override ? toISO(override.updatedAt) : nowIso,
				});
			}
		}

		return preferences;
	},
});

export const upsertPreference = mutation({
	args: {
		type: notificationType,
		channel: notificationChannel,
		enabled: v.boolean(),
		digestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		validateQuietHour(args.quietHoursStartMin, "quietHoursStartMin");
		validateQuietHour(args.quietHoursEndMin, "quietHoursEndMin");

		const existing = await ctx.db
			.query("notificationPreferences")
			.withIndex("by_user_type_channel", (q) =>
				q
					.eq("userId", userId)
					.eq("type", args.type)
					.eq("channel", args.channel),
			)
			.first();

		const now = Date.now();
		const digestMode =
			args.digestMode ?? existing?.digestMode ?? DEFAULT_DIGEST_MODE;

		if (existing) {
			await ctx.db.patch(existing._id, {
				enabled: args.enabled,
				digestMode,
				quietHoursStartMin:
					args.quietHoursStartMin ?? existing.quietHoursStartMin,
				quietHoursEndMin: args.quietHoursEndMin ?? existing.quietHoursEndMin,
				updatedAt: now,
			});
			return null;
		}

		await ctx.db.insert("notificationPreferences", {
			userId,
			type: args.type,
			channel: args.channel,
			enabled: args.enabled,
			digestMode,
			quietHoursStartMin: args.quietHoursStartMin,
			quietHoursEndMin: args.quietHoursEndMin,
			updatedAt: now,
		});
		return null;
	},
});

export const listSubscriptions = query({
	args: {},
	returns: v.array(notificationSubscriptionReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return docs.map((doc) => ({
			id: doc._id,
			subscriptionType: doc.subscriptionType,
			entityType: doc.entityType,
			entityId: doc.entityId,
			viewId: doc.viewId,
			updatedAt: toISO(doc.updatedAt),
		}));
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
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			subscriptionType: "view",
			viewId: args.viewId,
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

const STATUS_LABELS: Record<string, string> = {
	backlog: "Backlog",
	"to-do": "To Do",
	"in-progress": "In Progress",
	"awaiting-review": "Awaiting Review",
	done: "Done",
	cancelled: "Cancelled",
};

const PROGRESS_STATUS_LABELS: Record<string, string> = {
	"on-track": "On track",
	"at-risk": "At risk",
	"off-track": "Off track",
};

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

function formatDaysText(days: number): string {
	return days === 1 ? "1 day" : `${days} days`;
}

function getPriorityFromTaskPriority(
	taskPriority: Doc<"tasks">["priority"],
): "urgent" | "high" | "normal" {
	if (taskPriority === "urgent") return "urgent";
	if (taskPriority === "high") return "high";
	return "normal";
}

type TaskInfo = Pick<Doc<"tasks">, "_id" | "identifier" | "title" | "priority">;
type CompetitionInfo = Pick<Doc<"competitions">, "_id" | "name">;
type ActorInfo = {
	actorId?: Id<"users">;
	actorName?: string;
	actorAvatarUrl?: string;
};

type NotificationTemplateConfig = {
	title: string;
	message: string;
	priority: NotificationPriority;
	entityType: NotificationEntityType;
	parentTaskId?: Id<"tasks">;
	metadata?: NotificationMetadata;
	body?: string;
	isBatchable?: boolean;
	batchKey?: string;
};

const NotificationTemplates = {
	task_assigned: (task: TaskInfo, actor: ActorInfo): NotificationTemplateConfig => ({
		title: `Assigned to ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} assigned you to task ${task.identifier}: ${task.title}`,
		priority: getPriorityFromTaskPriority(task.priority),
		entityType: "task",
		metadata: actor,
	}),

	task_unassigned: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `Unassigned from ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} unassigned you from task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	task_mentioned: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `Mentioned in ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} mentioned you in a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "comment",
		parentTaskId: task._id,
		metadata: actor,
	}),

	comment_added: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `New comment on ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} added a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "comment",
		parentTaskId: task._id,
		metadata: actor,
	}),

	task_status_changed: (
		task: TaskInfo,
		actor: ActorInfo,
		oldStatus: string,
		newStatus: string,
	): NotificationTemplateConfig => {
		const oldLabel = STATUS_LABELS[oldStatus] ?? oldStatus;
		const newLabel = STATUS_LABELS[newStatus] ?? newStatus;
		return {
			title: `${task.identifier} status changed`,
			message: `${actor.actorName ?? "Someone"} moved task ${task.identifier} from "${oldLabel}" to "${newLabel}": ${task.title}`,
			priority: "normal",
			entityType: "task",
			metadata: { ...actor, oldValue: oldStatus, newValue: newStatus },
		};
	},

	task_awaiting_review: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} awaiting your review`,
		message: `${actor.actorName ?? "Someone"} marked task ${task.identifier} as awaiting review: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	relation_blocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${blockedTask.identifier} is blocked`,
		message: `${actor.actorName ?? "Someone"} blocked ${blockedTask.identifier} with ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "high",
		entityType: "task",
		metadata: {
			...actor,
			oldValue: blockingTask.identifier,
		},
	}),

	relation_unblocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${blockedTask.identifier} is unblocked`,
		message: `${actor.actorName ?? "Someone"} unblocked ${blockedTask.identifier} by resolving ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "normal",
		entityType: "task",
		metadata: {
			...actor,
			newValue: blockingTask.identifier,
		},
	}),

	due_date_approaching: (
		task: TaskInfo,
		daysUntil: number,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} due soon`,
		message: `Task ${task.identifier}: ${task.title} is due in ${formatDaysText(daysUntil)}`,
		priority: daysUntil <= 1 ? "high" : "normal",
		entityType: "task",
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	due_date_overdue: (
		task: TaskInfo,
		daysOverdue: number,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} is overdue`,
		message: `Task ${task.identifier}: ${task.title} is ${formatDaysText(daysOverdue)} overdue`,
		priority: "urgent",
		entityType: "task",
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	competition_phase_changed: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		oldPhase: string,
		newPhase: string,
	): NotificationTemplateConfig => ({
		title: `${competition.name} phase changed`,
		message: `${actor.actorName ?? "Someone"} moved ${competition.name} from "${oldPhase}" to "${newPhase}"`,
		priority: "normal",
		entityType: "competition",
		metadata: { ...actor, oldValue: oldPhase, newValue: newPhase },
	}),

	progress_update_added: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		status: string,
	): NotificationTemplateConfig => {
		const statusLabel = PROGRESS_STATUS_LABELS[status] ?? status;
		return {
			title: `Progress update: ${competition.name}`,
			message: `${actor.actorName ?? "Someone"} posted a ${statusLabel} update for ${competition.name}`,
			priority: "normal",
			entityType: "competition",
			metadata: { ...actor, newValue: status },
		};
	},

	reminder_triggered: (
		taskId: Id<"tasks">,
		message?: string,
	): NotificationTemplateConfig => ({
		title: `Reminder for task ${taskId}`,
		message: message ?? `Reminder for task ${taskId}`,
		priority: "normal",
		entityType: "reminder",
		parentTaskId: taskId,
		metadata: {},
	}),
};

type TaskNotificationType =
	| "task_assigned"
	| "task_unassigned"
	| "task_mentioned"
	| "comment_added"
	| "task_status_changed"
	| "task_awaiting_review"
	| "relation_blocked"
	| "relation_unblocked";

async function createTaskNotification(
	ctx: MutationCtx,
	type: TaskNotificationType,
	args: {
		taskId: Id<"tasks">;
		recipientId: Id<"users">;
		actorId: Id<"users">;
		commentId?: Id<"comments">;
		oldStatus?: string;
		newStatus?: string;
		blockingTaskId?: Id<"tasks">;
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) {
		return null;
	}

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;

	let config: NotificationTemplateConfig | null = null;
	let entity: NotificationEntityRef = {
		entityType: "task",
		entityId: task._id,
	};
	let payload: Record<string, string | number | boolean | null | undefined> = {
		type,
		taskId: task._id,
		eventKey,
	};

	switch (type) {
		case "task_assigned":
			config = NotificationTemplates.task_assigned(task, actor);
			break;
		case "task_unassigned":
			config = NotificationTemplates.task_unassigned(task, actor);
			break;
		case "task_mentioned":
			if (!args.commentId) {
				return null;
			}
			config = NotificationTemplates.task_mentioned(task, actor);
			entity = {
				entityType: "comment",
				entityId: args.commentId,
				parentTaskId: task._id,
			};
			payload = {
				...payload,
				commentId: args.commentId,
			};
			break;
		case "comment_added":
			if (!args.commentId) {
				return null;
			}
			config = NotificationTemplates.comment_added(task, actor);
			entity = {
				entityType: "comment",
				entityId: args.commentId,
				parentTaskId: task._id,
			};
			payload = {
				...payload,
				commentId: args.commentId,
			};
			break;
		case "task_status_changed":
			if (args.oldStatus === undefined || args.newStatus === undefined) {
				return null;
			}
			config = NotificationTemplates.task_status_changed(
				task,
				actor,
				args.oldStatus,
				args.newStatus,
			);
			payload = {
				...payload,
				oldStatus: args.oldStatus,
				newStatus: args.newStatus,
			};
			break;
		case "task_awaiting_review":
			config = NotificationTemplates.task_awaiting_review(task, actor);
			break;
		case "relation_blocked": {
			if (!args.blockingTaskId) {
				return null;
			}
			const blockingTask = await ctx.db.get("tasks", args.blockingTaskId);
			if (!blockingTask) {
				return null;
			}
			config = NotificationTemplates.relation_blocked(task, blockingTask, actor);
			payload = {
				...payload,
				blockingTaskId: args.blockingTaskId,
			};
			break;
		}
		case "relation_unblocked": {
			if (!args.blockingTaskId) {
				return null;
			}
			const blockingTask = await ctx.db.get("tasks", args.blockingTaskId);
			if (!blockingTask) {
				return null;
			}
			config = NotificationTemplates.relation_unblocked(task, blockingTask, actor);
			payload = {
				...payload,
				blockingTaskId: args.blockingTaskId,
			};
			break;
		}
	}

	if (!config) {
		return null;
	}

	const inserted = await emitInAppNotifications(ctx, {
		type,
		entity,
		recipients: [args.recipientId],
		actorId: args.actorId,
		title: config.title,
		message: config.message,
		priority: config.priority,
		metadata: config.metadata,
		body: config.body,
		isBatchable: config.isBatchable,
		batchKey: config.batchKey,
		idempotencyBase: `${type}:${task._id}:${task.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(payload),
		includeEntitySubscribers: true,
	});

	return inserted[0] ?? null;
}

async function createCompetitionNotification(
	ctx: MutationCtx,
	args: {
		type: "competition_phase_changed" | "progress_update_added";
		competitionId: Id<"competitions">;
		recipientId: Id<"users">;
		actorId: Id<"users">;
		oldPhaseName?: string;
		newPhaseName?: string;
		competitionName?: string;
		status?: "on-track" | "at-risk" | "off-track";
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const competition = await ctx.db.get("competitions", args.competitionId);
	if (!competition) {
		return null;
	}

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;

	let config: NotificationTemplateConfig | null = null;
	let payload: Record<string, string | number | boolean | null | undefined> = {
		type: args.type,
		competitionId: args.competitionId,
		eventKey,
	};

	if (args.type === "competition_phase_changed") {
		if (!args.oldPhaseName || !args.newPhaseName) {
			return null;
		}
		config = NotificationTemplates.competition_phase_changed(
			competition,
			actor,
			args.oldPhaseName,
			args.newPhaseName,
		);
		payload = {
			...payload,
			oldPhaseName: args.oldPhaseName,
			newPhaseName: args.newPhaseName,
		};
	} else {
		if (!args.competitionName || !args.status) {
			return null;
		}
		config = NotificationTemplates.progress_update_added(
			{ _id: competition._id, name: args.competitionName },
			actor,
			args.status,
		);
		payload = {
			...payload,
			competitionName: args.competitionName,
			status: args.status,
		};
	}

	const inserted = await emitInAppNotifications(ctx, {
		type: args.type,
		entity: {
			entityType: "competition",
			entityId: competition._id,
		},
		recipients: [args.recipientId],
		actorId: args.actorId,
		title: config.title,
		message: config.message,
		priority: config.priority,
		metadata: config.metadata,
		idempotencyBase: `${args.type}:${competition._id}:${competition.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(payload),
		includeEntitySubscribers: true,
	});

	return inserted[0] ?? null;
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
		recipientId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "comment_added", {
			taskId: args.taskId,
			commentId: args.commentId,
			recipientId: args.recipientId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskStatusChanged = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.id("users"),
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
			actorId: args.actorId,
			oldStatus: args.oldStatus,
			newStatus: args.newStatus,
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
		recipientId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_blocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
			actorId: args.actorId,
			eventKey: args.eventKey,
		}),
});

export const _notifyTaskRelationUnblocked = internalMutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_unblocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
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
		});
		return inserted[0] ?? null;
	},
});

export const _notifyCompetitionPhaseChanged = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.id("users"),
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
			actorId: args.actorId,
			oldPhaseName: args.oldPhaseName,
			newPhaseName: args.newPhaseName,
			eventKey: args.eventKey,
		}),
});

export const _notifyProgressUpdateAdded = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.id("users"),
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

const { APPROACHING_MS: APPROACHING_THRESHOLD_MS, MS_PER_DAY } =
	NOTIFICATION_THRESHOLDS;

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

			if (diffMs < 0) {
				const daysOverdue = Math.abs(daysDiff);
				const config = NotificationTemplates.due_date_overdue(task, daysOverdue);
				const inserted = await emitInAppNotifications(ctx, {
					type: "due_date_overdue",
					entity: { entityType: "task", entityId: task._id },
					recipients: [task.assigneeId],
					title: config.title,
					message: config.message,
					priority: config.priority,
					metadata: config.metadata,
					isBatchable: config.isBatchable,
					batchKey: config.batchKey,
					idempotencyBase: `due_date_overdue:${task._id}:${daysOverdue}:${dayBucket}`,
					payloadJson: serializePayload({
						taskId: task._id,
						daysOverdue,
						dayBucket,
					}),
				});
				notificationCount += inserted.length;
			} else if (diffMs <= APPROACHING_THRESHOLD_MS && diffMs > 0) {
				const config = NotificationTemplates.due_date_approaching(task, daysDiff);
				const inserted = await emitInAppNotifications(ctx, {
					type: "due_date_approaching",
					entity: { entityType: "task", entityId: task._id },
					recipients: [task.assigneeId],
					title: config.title,
					message: config.message,
					priority: config.priority,
					metadata: config.metadata,
					isBatchable: config.isBatchable,
					batchKey: config.batchKey,
					idempotencyBase: `due_date_approaching:${task._id}:${daysDiff}:${dayBucket}`,
					payloadJson: serializePayload({
						taskId: task._id,
						daysDiff,
						dayBucket,
					}),
				});
				notificationCount += inserted.length;
			}
		}

		return notificationCount;
	},
});
