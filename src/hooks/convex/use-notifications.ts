import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useRetainedQueryResult } from "./use-retained-query-result";

export const useNotificationSubscriptions = () => {
	const result = useQuery(api.notifications.subscriptions.listSubscriptions, {
		limit: 500,
	});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return { subscriptions: data ?? [], isLoading, isRefreshing };
};

export const useTaskSubscriptionState = (taskId: Id<"tasks"> | null) => {
	const result = useQuery(
		api.notifications.subscriptions.isSubscribedToEntity,
		taskId ? { entity: { entityType: "task", entityId: taskId } } : "skip",
	);
	const { data } = useRetainedQueryResult(result, taskId ?? "skip");
	return data ?? false;
};

export function useNotificationMutations() {
	const subscribeToEntity = useMutation(
		api.notifications.subscriptions.subscribeToEntity,
	);
	const unsubscribeFromEntity = useMutation(
		api.notifications.subscriptions.unsubscribeFromEntity,
	);
	const unsubscribe = useMutation(api.notifications.subscriptions.unsubscribe);

	return {
		subscribeToTask: (taskId: Id<"tasks">) =>
			subscribeToEntity({ entity: { entityType: "task", entityId: taskId } }),
		subscribeToCompetition: (competitionId: Id<"competitions">) =>
			subscribeToEntity({
				entity: { entityType: "competition", entityId: competitionId },
			}),
		subscribeToComment: (commentId: Id<"comments">) =>
			subscribeToEntity({
				entity: { entityType: "comment", entityId: commentId },
			}),
		unsubscribeFromTask: (taskId: Id<"tasks">) =>
			unsubscribeFromEntity({
				entity: { entityType: "task", entityId: taskId },
			}),
		unsubscribeFromCompetition: (competitionId: Id<"competitions">) =>
			unsubscribeFromEntity({
				entity: { entityType: "competition", entityId: competitionId },
			}),
		unsubscribeFromComment: (commentId: Id<"comments">) =>
			unsubscribeFromEntity({
				entity: { entityType: "comment", entityId: commentId },
			}),
		unsubscribeNotificationSubscription: (
			subscriptionId: Id<"notificationSubscriptions">,
		) => unsubscribe({ subscriptionId }),
	};
}
