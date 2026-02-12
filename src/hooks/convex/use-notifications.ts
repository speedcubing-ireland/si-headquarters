import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePeriodicNow } from "./use-periodic-now";

export const useNotifications = () => {
	const nowMs = usePeriodicNow();
	const d = useQuery(api.notifications.listForUser, { nowMs });
	return { notifications: d ?? [], isLoading: d === undefined };
};

export const useNotificationSettings = () => {
	const s = useQuery(api.notifications.getSettings, {});
	return {
		settings: s,
		preferences: s?.preferences ?? [],
		timezone: s?.timezone ?? "Europe/Dublin",
		defaultDigestMode: s?.defaultDigestMode ?? "immediate",
		quietHoursStartMin: s?.quietHoursStartMin,
		quietHoursEndMin: s?.quietHoursEndMin,
		isLoading: s === undefined,
	};
};

export const useNotificationSubscriptions = () => {
	const d = useQuery(api.notifications.listSubscriptions, { limit: 500 });
	return { subscriptions: d ?? [], isLoading: d === undefined };
};

export const useTaskSubscriptionState = (taskId: Id<"tasks"> | null) =>
	useQuery(
		api.notifications.isSubscribedToEntity,
		taskId ? { entity: { entityType: "task", entityId: taskId } } : "skip",
	) ?? false;

export const useUnreadCount = () => {
	const nowMs = usePeriodicNow();
	return useQuery(api.notifications.getUnreadCount, { nowMs });
};

export const useNotificationDiagnostics = () => {
	const dispatchHealth = useQuery(api.notifications.getDispatchHealth, {});
	const deadLetters = useQuery(api.notifications.listRecentDeadLetters, {
		limit: 20,
	});
	return {
		dispatchHealth,
		deadLetters: deadLetters ?? [],
		isLoading: dispatchHealth === undefined || deadLetters === undefined,
	};
};

export function useNotificationMutations() {
	const markReadMut = useMutation(api.notifications.markRead);
	const markArchivedMut = useMutation(api.notifications.markArchived);
	const markAllReadMut = useMutation(api.notifications.markAllRead);
	const snoozeMut = useMutation(api.notifications.snooze);
	const unsnoozeMut = useMutation(api.notifications.unsnooze);
	const upsertPrefMut = useMutation(api.notifications.upsertPreference);
	const upsertSettingsMut = useMutation(api.notifications.upsertSettings);
	const upsertUserSettingsMut = useMutation(
		api.notifications.upsertUserSettings,
	);
	const subEntityMut = useMutation(api.notifications.subscribeToEntity);
	const unsubEntityMut = useMutation(api.notifications.unsubscribeFromEntity);
	const unsubMut = useMutation(api.notifications.unsubscribe);

	const taskSub = {
		subscribe: (entityId: Id<"tasks">) =>
			subEntityMut({ entity: { entityType: "task" as const, entityId } }),
		unsubscribe: (entityId: Id<"tasks">) =>
			unsubEntityMut({ entity: { entityType: "task" as const, entityId } }),
	};
	const competitionSub = {
		subscribe: (entityId: Id<"competitions">) =>
			subEntityMut({
				entity: { entityType: "competition" as const, entityId },
			}),
		unsubscribe: (entityId: Id<"competitions">) =>
			unsubEntityMut({
				entity: { entityType: "competition" as const, entityId },
			}),
	};
	const commentSub = {
		subscribe: (entityId: Id<"comments">) =>
			subEntityMut({ entity: { entityType: "comment" as const, entityId } }),
		unsubscribe: (entityId: Id<"comments">) =>
			unsubEntityMut({ entity: { entityType: "comment" as const, entityId } }),
	};

	return {
		markNotificationRead: (id: Id<"notifications">) =>
			markReadMut({ notificationId: id }),
		markNotificationArchived: (id: Id<"notifications">) =>
			markArchivedMut({ notificationId: id }),
		markAllNotificationsRead: () => markAllReadMut({}),
		dismissNotification: (id: Id<"notifications">) =>
			markArchivedMut({ notificationId: id }),
		snoozeNotification: (id: Id<"notifications">, snoozedUntil: string) =>
			snoozeMut({ notificationId: id, snoozedUntil }),
		unsnoozeNotification: (id: Id<"notifications">) =>
			unsnoozeMut({ notificationId: id }),
		upsertNotificationPreference: (payload: {
			type: Parameters<typeof upsertPrefMut>[0]["type"];
			channel: Parameters<typeof upsertPrefMut>[0]["channel"];
			enabled?: boolean;
			digestMode?: Parameters<typeof upsertPrefMut>[0]["digestMode"];
			respectQuietHours?: boolean;
			clearOverride?: boolean;
		}) => upsertPrefMut(payload),
		upsertNotificationSettings: (
			payload: Parameters<typeof upsertSettingsMut>[0],
		) => upsertSettingsMut(payload),
		upsertNotificationUserSettings: (
			payload: Parameters<typeof upsertUserSettingsMut>[0],
		) => upsertUserSettingsMut(payload),
		subscribeToTask: (taskId: Id<"tasks">) => taskSub.subscribe(taskId),
		subscribeToCompetition: (id: Id<"competitions">) =>
			competitionSub.subscribe(id),
		subscribeToComment: (id: Id<"comments">) => commentSub.subscribe(id),
		unsubscribeFromTask: (taskId: Id<"tasks">) => taskSub.unsubscribe(taskId),
		unsubscribeFromCompetition: (id: Id<"competitions">) =>
			competitionSub.unsubscribe(id),
		unsubscribeFromComment: (id: Id<"comments">) => commentSub.unsubscribe(id),
		unsubscribeNotificationSubscription: (
			id: Id<"notificationSubscriptions">,
		) => unsubMut({ subscriptionId: id }),
	};
}
