import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	notificationChannel,
	notificationDigestMode,
	notificationMetadata,
	notificationPriority,
	notificationStatus,
	notificationSubscriberEntityType,
	notificationSubscriptionType,
	notificationType,
} from "./validators";
import { NOTIFICATION_DEFAULTS, NOTIFICATION_LIST_LIMITS } from "./constants";



export const IN_APP_CHANNEL: NotificationChannel = "in_app";
export const EMAIL_CHANNEL: NotificationChannel = "email";
export const SUPPORTED_NOTIFICATION_CHANNELS: NotificationChannel[] = [
	IN_APP_CHANNEL,
	EMAIL_CHANNEL,
];
export const EXTERNAL_NOTIFICATION_CHANNELS: NotificationChannel[] = [
	EMAIL_CHANNEL,
];
export const DEFAULT_DIGEST_MODE: NotificationDigestMode = "immediate";
export const DEFAULT_TIMEZONE = NOTIFICATION_DEFAULTS.TIMEZONE;
export const DEFAULT_SUBSCRIPTION_LIST_LIMIT = 100;
export const MAX_SUBSCRIPTION_LIST_LIMIT = NOTIFICATION_LIST_LIMITS.MAX;
export const EMAIL_DISPATCH_GROUP_CLAIM_PREFIX = "email_group_claim:";
export const EMAIL_DISPATCH_GROUP_CLAIM_TTL_MS = 5 * 60 * 1000;



export type NotificationMetadata = Infer<typeof notificationMetadata>;
export type NotificationType = Infer<typeof notificationType>;
export type NotificationPriority = Infer<typeof notificationPriority>;
export type NotificationChannel = Infer<typeof notificationChannel>;
export type NotificationDigestMode = Infer<typeof notificationDigestMode>;
export type NotificationSubscriberEntityType = Infer<
	typeof notificationSubscriberEntityType
>;
export type NotificationViewEntityType = "tasks" | "competitions";
export type EntitySubscriptionArg = Infer<typeof entitySubscriptionArgs>;

export type NotificationEntityType =
	| "task"
	| "comment"
	| "competition"
	| "reminder";
export type DispatchStatus = "pending" | "sent" | "skipped" | "failed";
export type ScheduledFunctionId = Id<"_scheduled_functions">;

export type DbReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export type NotificationUserSettingsResolved = {
	timezone: string;
	defaultDigestMode: NotificationDigestMode;
	quietHoursStartMin: number | undefined;
	quietHoursEndMin: number | undefined;
	updatedAt: number;
};



export const notificationEntityType = v.union(
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

export const notificationPreferenceReturns = v.object({
	type: notificationType,
	channel: notificationChannel,
	enabled: v.boolean(),
	digestMode: notificationDigestMode,
	respectQuietHours: v.boolean(),
	isOverride: v.boolean(),
	updatedAt: v.string(),
});

export const notificationUserSettingsReturns = v.object({
	timezone: v.string(),
	defaultDigestMode: notificationDigestMode,
	quietHoursStartMin: v.optional(v.number()),
	quietHoursEndMin: v.optional(v.number()),
	updatedAt: v.string(),
});

export const notificationSettingsReturns = v.object({
	timezone: v.string(),
	defaultDigestMode: notificationDigestMode,
	quietHoursStartMin: v.optional(v.number()),
	quietHoursEndMin: v.optional(v.number()),
	preferences: v.array(notificationPreferenceReturns),
});

export const notificationSubscriptionReturns = v.object({
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

export const notificationDispatchStatsReturns = v.object({
	pending: v.number(),
	sent: v.number(),
	skipped: v.number(),
	failed: v.number(),
});

export const entitySubscriptionArgs = v.union(
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



export type NotificationEntityRef =
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

export type NotificationEmitInput = {
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

export type NotificationPayload = Record<
	string,
	string | number | boolean | null | undefined
>;

export type EmailDispatchSnapshot = {
	type: NotificationType;
	title: string;
	message: string;
	body?: string;
	entityType: NotificationEntityType;
	entityId: string;
	parentEntityId?: string;
	priority: NotificationPriority;
	actorName?: string;
};

export type NotificationPreferenceConfig = {
	enabled: boolean;
	digestMode: NotificationDigestMode;
	respectQuietHours: boolean;
	quietHoursStartMin?: number;
	quietHoursEndMin?: number;
};

export type RecipientSkipDecision = {
	inAppStatus: DispatchStatus;
	externalStatus: DispatchStatus;
	reason: string;
	externalReason?: string;
};

export type RecipientDecision =
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
