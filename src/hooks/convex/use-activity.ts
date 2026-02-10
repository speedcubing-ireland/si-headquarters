import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export const useActivityForTask = (taskId: string | null) => {
	const d = useQuery(
		api.activity.listForEntity,
		taskId ? { entityType: "task", entityId: taskId } : "skip",
	);
	return { activities: d ?? [], isLoading: d === undefined };
};

export const useRecentActivity = (limit = 50) => {
	const d = useQuery(api.activity.listRecentForUser, { limit });
	return { activities: d ?? [], isLoading: d === undefined };
};

export const useGlobalActivity = (limit = 50) => {
	const d = useQuery(api.activity.listRecent, { limit });
	return { activities: d ?? [], isLoading: d === undefined };
};
