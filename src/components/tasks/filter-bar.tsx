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
			<div className="flex shrink-0 items-center gap-2">
				<TasksFilterPopover />
			</div>
			<div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:basis-auto sm:flex-1">
				<TasksFilterChips />
			</div>
			<div className="ml-auto flex shrink-0 items-center gap-2">
				<TasksDisplaySettings />
				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						onClick={toggleMatchMode}
						className="hidden sm:inline-flex"
					>
						<span className="sm:hidden">
							{matchMode === "any" ? "Any filter" : "All filters"}
						</span>
						<span className="hidden sm:inline">
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</span>
					</Button>
				)}
			</div>
		</>
	);
}
