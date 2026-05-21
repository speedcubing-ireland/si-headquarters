import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
	type notificationMetadata,
	type notificationPriority,
	notificationSubscriberEntityType,
	type notificationType,
} from "./validators";

export type NotificationMetadata = Infer<typeof notificationMetadata>;
export type NotificationType = Infer<typeof notificationType>;
export type NotificationPriority = Infer<typeof notificationPriority>;
export type NotificationSubscriberEntityType = Infer<
	typeof notificationSubscriberEntityType
>;

export const DEFAULT_SUBSCRIPTION_LIST_LIMIT = 100;
export const MAX_SUBSCRIPTION_LIST_LIMIT = 500;

export const notificationEntityType = v.union(
	v.literal("task"),
	v.literal("comment"),
	v.literal("competition"),
	v.literal("reminder"),
);

export type NotificationEntityType = Infer<typeof notificationEntityType>;

export const notificationSubscriptionReturns = v.object({
	id: v.id("notificationSubscriptions"),
	entityType: notificationSubscriberEntityType,
	entityId: v.string(),
	label: v.string(),
	description: v.optional(v.string()),
	isStale: v.boolean(),
	updatedAt: v.string(),
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

export type EntitySubscriptionArg = Infer<typeof entitySubscriptionArgs>;

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
	idempotencyBase: string;
	payloadJson?: string;
	includeEntitySubscribers?: boolean;
	suppressActorRecipient?: boolean;
	forceRecipientDelivery?: boolean;
};

export type NotificationPayload = Record<
	string,
	string | number | boolean | null | undefined
>;
