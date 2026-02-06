import type {
	NotificationPreference,
	NotificationType,
} from "@/data/types-new";

export const NOTIFICATION_TYPE_OPTIONS: Array<{
	value: NotificationType;
	label: string;
}> = [
	{ value: "task_assigned", label: "Task assigned" },
	{ value: "task_unassigned", label: "Task unassigned" },
	{ value: "task_mentioned", label: "Task mentioned" },
	{ value: "task_status_changed", label: "Task status changed" },
	{ value: "task_priority_changed", label: "Task priority changed" },
	{ value: "task_awaiting_review", label: "Task awaiting review" },
	{ value: "due_date_approaching", label: "Due date approaching" },
	{ value: "due_date_overdue", label: "Due date overdue" },
	{ value: "comment_added", label: "Comment added" },
	{ value: "comment_replied", label: "Comment replied" },
	{ value: "relation_blocked", label: "Task blocked" },
	{ value: "relation_unblocked", label: "Task unblocked" },
	{ value: "competition_phase_changed", label: "Competition phase changed" },
	{ value: "progress_update_added", label: "Progress update added" },
	{ value: "reminder_triggered", label: "Reminder triggered" },
];

export const DIGEST_OPTIONS = [
	{ value: "immediate", label: "Immediate" },
	{ value: "hourly", label: "Hourly digest" },
	{ value: "daily", label: "Daily digest" },
	{ value: "three_daily", label: "3x daily digest" },
] as const;

export const CHANNEL_LABELS: Record<
	"in_app" | "email" | "slack" | "push",
	string
> = {
	in_app: "In-app",
	email: "Email",
	slack: "Slack",
	push: "Push",
};

export const IMPLEMENTED_SETTINGS_CHANNELS: ReadonlyArray<
	NotificationPreference["channel"]
> = ["in_app"];

export function isNotificationType(value: string): value is NotificationType {
	return NOTIFICATION_TYPE_OPTIONS.some((option) => option.value === value);
}

export function isDigestMode(
	value: string,
): value is NotificationPreference["digestMode"] {
	return DIGEST_OPTIONS.some((option) => option.value === value);
}

export function minutesToTimeInput(value: number | undefined): string {
	if (value === undefined) {
		return "";
	}
	const hours = Math.floor(value / 60)
		.toString()
		.padStart(2, "0");
	const minutes = (value % 60).toString().padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function timeInputToMinutes(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const [hoursRaw, minutesRaw] = value.split(":");
	if (!hoursRaw || !minutesRaw) {
		return undefined;
	}
	const hours = Number(hoursRaw);
	const minutes = Number(minutesRaw);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return undefined;
	}
	return hours * 60 + minutes;
}
