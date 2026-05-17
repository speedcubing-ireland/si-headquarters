import type { Infer } from "convex/values";
import type { notificationType, notificationWatcherLevel } from "./validators";
import { CHANNEL_SCOPED_NOTIFICATION_TYPES } from "./validators";

export type NotificationWatcherLevel = Infer<typeof notificationWatcherLevel>;
export type WatcherNotificationType = Infer<typeof notificationType>;

export const CHANNEL_WATCHER_NOTIFICATION_TYPES =
	CHANNEL_SCOPED_NOTIFICATION_TYPES;

export const DEFAULT_WATCHER_NOTIFICATION_TYPES = {
	channel: [
		"task_status_changed",
		"task_awaiting_review",
		"task_approved",
		"task_unapproved",
		"due_date_changed",
		"relation_unblocked",
		"competition_phase_changed",
		"progress_update_added",
	],
	competition: [
		"task_status_changed",
		"task_priority_changed",
		"task_awaiting_review",
		"task_approved",
		"task_unapproved",
		"due_date_changed",
		"relation_unblocked",
		"competition_phase_changed",
		"progress_update_added",
	],
	task: [
		"task_assigned",
		"task_unassigned",
		"task_status_changed",
		"task_priority_changed",
		"task_awaiting_review",
		"due_date_approaching",
		"due_date_overdue",
		"comment_added",
		"relation_unblocked",
		"task_approved",
		"task_unapproved",
		"due_date_changed",
	],
} as const satisfies Record<
	NotificationWatcherLevel,
	readonly WatcherNotificationType[]
>;

export const TARGETED_NOTIFICATION_TYPES = [
	"task_mentioned",
	"comment_replied",
	"reminder_triggered",
] as const satisfies readonly WatcherNotificationType[];

export function getDefaultWatcherNotificationTypes(
	level: NotificationWatcherLevel,
): WatcherNotificationType[] {
	return [...DEFAULT_WATCHER_NOTIFICATION_TYPES[level]];
}

export function isTargetedNotificationType(
	type: WatcherNotificationType,
): boolean {
	return TARGETED_NOTIFICATION_TYPES.includes(
		type as (typeof TARGETED_NOTIFICATION_TYPES)[number],
	);
}

export function filterChannelWatcherNotificationTypes(
	types: readonly WatcherNotificationType[],
): WatcherNotificationType[] {
	const allowed = new Set<WatcherNotificationType>(
		CHANNEL_WATCHER_NOTIFICATION_TYPES,
	);
	return [...new Set(types.filter((type) => allowed.has(type)))];
}
