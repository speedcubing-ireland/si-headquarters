import type {
	NotificationPreference,
	NotificationType,
} from "@/data/types-new";
import {
	NOTIFICATION_TYPE_OPTIONS,
	getNotificationTypeLabel,
} from "@/lib/notification-utils";

export type SettingSaveState = "idle" | "saving" | "saved" | "error";

export type SaveStateEvent = "start" | "succeed" | "fail" | "reset";

export type NotificationChannel = NotificationPreference["channel"];

export type PreferenceSource = {
	type: NotificationType;
	channel: NotificationChannel;
	enabled: boolean;
	isOverride: boolean;
	respectQuietHours: boolean;
};

export type SubscriptionSource<TId extends string = string> = {
	id: TId;
	entityType: string;
	label: string;
	description?: string;
	isStale: boolean;
};

export type PreferenceRowViewModel = {
	key: string;
	type: NotificationType;
	label: string;
	channel: NotificationChannel;
	enabled: boolean;
	isOverride: boolean;
	respectQuietHours: boolean;
	saveState: SettingSaveState;
};

export type SubscriptionFilter = "all" | "active" | "stale";

const notificationTypeOrder = new Map(
	NOTIFICATION_TYPE_OPTIONS.map((option, index) => [option.value, index]),
);

export function getPreferenceSaveKey(
	type: NotificationType,
	channel: NotificationChannel,
): string {
	return `preference:${channel}:${type}`;
}

export function getSubscriptionSaveKey(subscriptionId: string): string {
	return `subscription:${subscriptionId}`;
}

export function buildPreferenceRows(
	preferences: PreferenceSource[],
	readSaveState?: (key: string) => SettingSaveState,
): {
	emailRows: PreferenceRowViewModel[];
	inAppRows: PreferenceRowViewModel[];
} {
	const getSaveState = readSaveState ?? (() => "idle");
	const sorted = [...preferences].sort(
		(a, b) =>
			(notificationTypeOrder.get(a.type) ?? 0) -
			(notificationTypeOrder.get(b.type) ?? 0),
	);

	const rows = sorted.map((preference) => {
		const key = getPreferenceSaveKey(preference.type, preference.channel);
		return {
			key,
			type: preference.type,
			label: getNotificationTypeLabel(preference.type),
			channel: preference.channel,
			enabled: preference.enabled,
			isOverride: preference.isOverride,
			respectQuietHours: preference.respectQuietHours,
			saveState: getSaveState(key),
		} satisfies PreferenceRowViewModel;
	});

	return {
		emailRows: rows.filter((row) => row.channel === "email"),
		inAppRows: rows.filter((row) => row.channel === "in_app"),
	};
}

export function filterPreferenceRows(
	rows: PreferenceRowViewModel[],
	query: string,
): PreferenceRowViewModel[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return rows;
	}
	return rows.filter((row) =>
		row.label.toLowerCase().includes(normalizedQuery),
	);
}

export function deriveEmailBulkState(rows: PreferenceRowViewModel[]): {
	total: number;
	enabledCount: number;
	disabledCount: number;
	canEnableAll: boolean;
	canDisableAll: boolean;
} {
	const enabledCount = rows.filter((row) => row.enabled).length;
	const total = rows.length;
	const disabledCount = total - enabledCount;

	return {
		total,
		enabledCount,
		disabledCount,
		canEnableAll: disabledCount > 0,
		canDisableAll: enabledCount > 0,
	};
}

export function filterSubscriptions<TId extends string>(
	subscriptions: SubscriptionSource<TId>[],
	filter: SubscriptionFilter,
	query: string,
): SubscriptionSource<TId>[] {
	const normalizedQuery = query.trim().toLowerCase();

	return subscriptions.filter((subscription) => {
		const matchesFilter =
			filter === "all" ||
			(filter === "stale" ? subscription.isStale : !subscription.isStale);
		if (!matchesFilter) {
			return false;
		}
		if (!normalizedQuery) {
			return true;
		}
		const haystack = [
			subscription.label,
			subscription.description,
			subscription.entityType,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
		return haystack.includes(normalizedQuery);
	});
}

export function deriveSubscriptionBulkState<TId extends string>(
	subscriptions: SubscriptionSource<TId>[],
): {
	total: number;
	staleCount: number;
	activeCount: number;
	canCleanupStale: boolean;
} {
	const staleCount = subscriptions.filter(
		(subscription) => subscription.isStale,
	).length;
	const total = subscriptions.length;

	return {
		total,
		staleCount,
		activeCount: total - staleCount,
		canCleanupStale: staleCount > 0,
	};
}

export function transitionSaveState(
	currentState: SettingSaveState,
	event: SaveStateEvent,
): SettingSaveState {
	switch (event) {
		case "start":
			return "saving";
		case "succeed":
			return "saved";
		case "fail":
			return "error";
		case "reset":
			return "idle";
		default:
			return currentState;
	}
}
