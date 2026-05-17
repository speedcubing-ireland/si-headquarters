import { v } from "convex/values";

export const NOTIFICATION_TYPES = [
	"task_assigned",
	"task_unassigned",
	"task_mentioned",
	"task_status_changed",
	"task_priority_changed",
	"task_awaiting_review",
	"due_date_approaching",
	"due_date_overdue",
	"comment_added",
	"comment_replied",
	"relation_blocked",
	"relation_unblocked",
	"task_approved",
	"task_unapproved",
	"due_date_changed",
	"competition_phase_changed",
	"progress_update_added",
	"reminder_triggered",
] as const;

export const notificationType = v.union(
	...NOTIFICATION_TYPES.map((type) => v.literal(type)),
);

export const CHANNEL_SCOPED_NOTIFICATION_TYPES = [
	"task_assigned",
	"task_unassigned",
	"task_status_changed",
	"task_priority_changed",
	"task_awaiting_review",
	"due_date_approaching",
	"due_date_overdue",
	"comment_added",
	"task_approved",
	"task_unapproved",
	"due_date_changed",
	"relation_unblocked",
	"competition_phase_changed",
	"progress_update_added",
] as const;

export const NOTIFICATION_WATCHER_LEVELS = [
	"channel",
	"competition",
	"task",
] as const;

export const notificationWatcherLevel = v.union(
	...NOTIFICATION_WATCHER_LEVELS.map((level) => v.literal(level)),
);

export const NOTIFICATION_PRIORITIES = [
	"low",
	"normal",
	"high",
	"urgent",
] as const;

export const notificationPriority = v.union(
	...NOTIFICATION_PRIORITIES.map((priority) => v.literal(priority)),
);

export const NOTIFICATION_CHANNELS = [
	"in_app",
	"email",
	"slack",
	"push",
] as const;

export const notificationChannel = v.union(
	...NOTIFICATION_CHANNELS.map((channel) => v.literal(channel)),
);

export const NOTIFICATION_DIGEST_MODES = [
	"immediate",
	"hourly",
	"daily",
	"three_daily",
] as const;

export const notificationDigestMode = v.union(
	...NOTIFICATION_DIGEST_MODES.map((mode) => v.literal(mode)),
);

export const NOTIFICATION_DISPATCH_STATUSES = [
	"pending",
	"sending",
	"sent",
	"skipped",
	"failed",
] as const;

export const notificationDispatchStatus = v.union(
	...NOTIFICATION_DISPATCH_STATUSES.map((status) => v.literal(status)),
);

export const notificationSubscriberEntityType = v.union(
	v.literal("task"),
	v.literal("competition"),
	v.literal("comment"),
);

export const notificationStatus = v.union(
	v.literal("unread"),
	v.literal("read"),
	v.literal("archived"),
);

export const notificationMetadata = v.optional(
	v.object({
		actorId: v.optional(v.id("users")),
		actorName: v.optional(v.string()),
		actorAvatarUrl: v.optional(v.string()),
		oldValue: v.optional(v.string()),
		newValue: v.optional(v.string()),
	}),
);
