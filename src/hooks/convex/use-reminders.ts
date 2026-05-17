import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Reminder } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export const usePendingReminders = () => {
	const result = useQuery(api.reminders.api.listPendingForUser, {});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return { reminders: data ?? [], isLoading, isRefreshing };
};

export const usePendingRemindersForTask = (taskId: Id<"tasks"> | null) => {
	const result = useQuery(
		api.reminders.api.listPendingForTask,
		taskId ? { taskId } : "skip",
	);
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(
		result,
		taskId ?? "skip",
	);
	return {
		reminders: data ?? [],
		isLoading: taskId !== null && isLoading,
		isRefreshing: taskId !== null && isRefreshing,
	};
};

export function useReminderMutations() {
	const createMut = useMutation(api.reminders.api.create);
	const cancelMut = useMutation(api.reminders.api.cancel);
	const dismissMut = useMutation(api.reminders.api.dismiss);
	const snoozeMut = useMutation(api.reminders.api.snooze);
	const rescheduleMut = useMutation(api.reminders.api.reschedule);

	return {
		addReminder: (
			payload: Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId">,
		) =>
			createMut({
				entityId: payload.entityId,
				type: payload.type,
				remindAt: payload.remindAt,
				recurringPattern: payload.recurringPattern,
				recurringConfig: payload.recurringConfig,
				endDate: payload.endDate,
				message: payload.message,
				priority: payload.priority,
				metadata: payload.metadata ?? {},
			}),
		cancelReminder: (reminderId: Id<"reminders">) => cancelMut({ reminderId }),
		dismissReminder: (reminderId: Id<"reminders">) =>
			dismissMut({ reminderId }),
		snoozeReminder: (reminderId: Id<"reminders">, snoozeUntil: string) =>
			snoozeMut({ reminderId, snoozeUntil }),
		rescheduleReminder: (reminderId: Id<"reminders">, remindAt: string) =>
			rescheduleMut({ reminderId, remindAt }),
	};
}

export const buildOneTimeReminderPayload = (
	taskId: Id<"tasks">,
	remindAt: string,
	message?: string,
): Omit<Reminder, "id" | "createdAt" | "updatedAt" | "userId"> => ({
	entityId: taskId,
	entityType: "task",
	type: "one_time",
	remindAt,
	recurringPattern: undefined,
	recurringConfig: undefined,
	endDate: undefined,
	triggeredAt: undefined,
	dismissedAt: undefined,
	status: "pending",
	priority: "normal",
	metadata: {},
	message: message ?? "",
});
