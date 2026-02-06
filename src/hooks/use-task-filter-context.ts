import { useUsers, useTeams, useLabels } from "@/hooks/use-convex-data";
import type { FilterContext } from "@/lib/task-filter-definitions";

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
