import type { Doc } from "../../_generated/dataModel";
import {
	NOTIFICATION_DEFAULTS,
	NOTIFICATION_THRESHOLDS,
} from "../../lib/constants";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
} from "./notificationTemplates";
import type { NotificationPayload } from "./notificationTypes";

const { APPROACHING_MS: APPROACHING_THRESHOLD_MS, MS_PER_DAY } =
	NOTIFICATION_THRESHOLDS;

export const APPROACHING_THRESHOLD_DAYS = Math.floor(
	APPROACHING_THRESHOLD_MS / MS_PER_DAY,
);

const dublinDueDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: NOTIFICATION_DEFAULTS.TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function dublinDateKey(timestamp: number): string {
	return dublinDueDateFormatter.format(new Date(timestamp));
}

export function computeDueDateDaysDiff(
	dueDateStr: string,
	nowMs: number,
): number {
	const todayKey = dublinDateKey(nowMs);
	const dueKey = dueDateStr.slice(0, 10);
	const todayMs = new Date(todayKey).getTime();
	const dueMs = new Date(dueKey).getTime();
	return Math.round((dueMs - todayMs) / MS_PER_DAY);
}

export type DueDateNotificationSpec = {
	type: "due_date_overdue" | "due_date_approaching";
	config: NotificationTemplateConfig;
	idempotencyBase: string;
	payload: NotificationPayload;
};

export function buildDueDateNotificationSpec(
	task: Doc<"tasks">,
	daysDiff: number,
	dayBucket: number,
): DueDateNotificationSpec | null {
	if (daysDiff < 0) {
		const days = Math.abs(daysDiff);
		return {
			type: "due_date_overdue",
			config: NotificationTemplates.due_date_overdue(task, days),
			idempotencyBase: `due_date_overdue:${task._id}:${days}:${dayBucket}`,
			payload: { taskId: task._id, daysOverdue: days, dayBucket },
		};
	}

	if (daysDiff <= APPROACHING_THRESHOLD_DAYS) {
		return {
			type: "due_date_approaching",
			config: NotificationTemplates.due_date_approaching(task, daysDiff),
			idempotencyBase: `due_date_approaching:${task._id}:${daysDiff}:${dayBucket}`,
			payload: { taskId: task._id, daysDiff, dayBucket },
		};
	}

	return null;
}

export { MS_PER_DAY };
