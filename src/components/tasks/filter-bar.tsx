import { Button } from "@/components/ui/button";
import { TasksDisplaySettings } from "./display-settings";
import { TasksFilterChips } from "./filter-chips";
import { TasksFilterPopover } from "./filter-popover";
import { useTasksUrlContext } from "@/lib/tasks-url-context";

export function FilterBar() {
	const { matchMode, setMatchMode, filters } = useTasksUrlContext();

	const hasActiveFilters =
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.assignee.length > 0 ||
		filters.labels.length > 0 ||
		filters.owner.length > 0 ||
		filters.parentType.length > 0 ||
		filters.dateRange !== undefined;

	const toggleMatchMode = () => {
		setMatchMode(matchMode === "any" ? "all" : "any");
	};

	return (
		<>
			<div className="flex items-center gap-2 shrink-0">
				<TasksFilterPopover />
			</div>
			<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
				<TasksFilterChips />
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<TasksDisplaySettings />
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
						{matchMode === "any" ? "Match any filter" : "Match all filters"}
					</Button>
				)}
			</div>
		</>
	);
}
