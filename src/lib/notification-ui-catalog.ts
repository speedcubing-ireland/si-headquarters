import {
	AlertCircle,
	AlertTriangle,
	Bell,
	Calendar,
	CheckCircle2,
	Clock,
	Link2,
	MessageCircle,
	User,
	XCircle,
} from "lucide-react";
import type { NotificationType } from "@/data/types-new";

type NotificationIconConfig = {
	Icon: typeof Bell;
	className: string;
};

type NotificationUiCatalogEntry = {
	label: string;
	icon: NotificationIconConfig;
};

const DEFAULT_NOTIFICATION_ICON: NotificationIconConfig = {
	Icon: Bell,
	className: "size-5 text-muted-foreground",
};

const NOTIFICATION_UI_CATALOG = {
	task_assigned: {
		label: "Task assigned",
		icon: { Icon: User, className: "size-5 text-primary" },
	},
	task_unassigned: {
		label: "Task unassigned",
		icon: { Icon: User, className: "size-5 text-muted-foreground" },
	},
	task_mentioned: {
		label: "Task mentioned",
		icon: { Icon: MessageCircle, className: "size-5 text-primary" },
	},
	task_status_changed: {
		label: "Task status changed",
		icon: { Icon: CheckCircle2, className: "size-5 text-primary" },
	},
	task_priority_changed: {
		label: "Task priority changed",
		icon: { Icon: AlertTriangle, className: "size-5 text-warning" },
	},
	task_awaiting_review: {
		label: "Task awaiting review",
		icon: { Icon: CheckCircle2, className: "size-5 text-primary" },
	},
	due_date_approaching: {
		label: "Due date approaching",
		icon: { Icon: Clock, className: "size-5 text-muted-foreground" },
	},
	due_date_overdue: {
		label: "Due date overdue",
		icon: { Icon: AlertCircle, className: "size-5 text-destructive" },
	},
	comment_added: {
		label: "Comment added",
		icon: { Icon: MessageCircle, className: "size-5 text-primary" },
	},
	comment_replied: {
		label: "Comment replied",
		icon: { Icon: MessageCircle, className: "size-5 text-primary" },
	},
	relation_blocked: {
		label: "Task blocked",
		icon: { Icon: AlertTriangle, className: "size-5 text-destructive" },
	},
	relation_unblocked: {
		label: "Task unblocked",
		icon: { Icon: CheckCircle2, className: "size-5 text-primary" },
	},
	task_approved: {
		label: "Task approved",
		icon: { Icon: CheckCircle2, className: "size-5 text-primary" },
	},
	task_unapproved: {
		label: "Task approval withdrawn",
		icon: { Icon: XCircle, className: "size-5 text-muted-foreground" },
	},
	due_date_changed: {
		label: "Due date changed",
		icon: { Icon: Calendar, className: "size-5 text-primary" },
	},
	competition_phase_changed: {
		label: "Competition phase changed",
		icon: { Icon: Link2, className: "size-5 text-primary" },
	},
	progress_update_added: {
		label: "Progress update added",
		icon: { Icon: Bell, className: "size-5 text-muted-foreground" },
	},
	reminder_triggered: {
		label: "Reminder triggered",
		icon: { Icon: Calendar, className: "size-5 text-primary" },
	},
} as const satisfies Record<NotificationType, NotificationUiCatalogEntry>;

const NOTIFICATION_TYPE_SET = new Set<NotificationType>(
	Object.keys(NOTIFICATION_UI_CATALOG) as NotificationType[],
);

export const NOTIFICATION_TYPE_OPTIONS: Array<{
	value: NotificationType;
	label: string;
}> = (
	Object.entries(NOTIFICATION_UI_CATALOG) as Array<
		[NotificationType, NotificationUiCatalogEntry]
	>
).map(([value, entry]) => ({
	value,
	label: entry.label,
}));

export function getNotificationTypeLabel(type: NotificationType): string {
	return NOTIFICATION_UI_CATALOG[type]?.label ?? type;
}

export function getNotificationIconConfig(
	type: NotificationType,
): NotificationIconConfig {
	return NOTIFICATION_UI_CATALOG[type]?.icon ?? DEFAULT_NOTIFICATION_ICON;
}

export function isNotificationType(value: string): value is NotificationType {
	return NOTIFICATION_TYPE_SET.has(value as NotificationType);
}
