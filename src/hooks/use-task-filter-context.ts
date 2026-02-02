import { useDataV2 } from "@/data/data-store-v2";
import type { FilterContext } from "@/lib/task-filter-definitions";

/**
 * Hook to get the filter context for task filter operations.
 * Combines users, teams, and labels from the data store.
 *
 * Used by filter components to build dynamic filter options
 * like assignee (users), owner (users + teams), and labels.
 */
export function useTaskFilterContext(): FilterContext {
	const users = useDataV2((state) => state.users);
	const teams = useDataV2((state) => state.teams);
	const labels = useDataV2((state) => state.labels);

	return {
		users,
		teams,
		labels,
	};
}
