import { useUsers, useTeams, useLabels } from "@/hooks/use-convex-data";
import type { FilterContext } from "@/lib/task-filter-definitions";

/**
 * Hook to get the filter context for task filter operations.
 * Combines users, teams, and labels from Convex.
 *
 * Used by filter components to build dynamic filter options
 * like assignee (users), owner (users + teams), and labels.
 */
export function useTaskFilterContext(): FilterContext {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { labels } = useLabels();

	return {
		users,
		teams,
		labels,
	};
}
