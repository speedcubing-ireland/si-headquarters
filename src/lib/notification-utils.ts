import type { NotificationPreference } from "@/data/types-new";
import {
	NOTIFICATION_TYPE_OPTIONS,
	getNotificationTypeLabel,
	isNotificationType,
} from "@/lib/notification-ui-catalog";

export {
	NOTIFICATION_TYPE_OPTIONS,
	getNotificationTypeLabel,
	isNotificationType,
};

export const DIGEST_OPTIONS = [
	{ value: "immediate", label: "Immediate" },
	{ value: "hourly", label: "Hourly digest" },
	{ value: "daily", label: "Daily digest" },
	{ value: "three_daily", label: "3x daily digest" },
] as const;

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
