import { Button } from "@/components/ui/button";
import { TasksDisplaySettings } from "./display-settings";
import { TasksFilterChips } from "./filter-chips";
import { TasksFilterPopover } from "./filter-popover";
import { useTasksPageContext } from "@/store/tasks-page-context";

export function FilterBar() {
	const { filterStore } = useTasksPageContext();

	const matchMode = filterStore((state) => state.matchMode);
	const toggleMatchMode = filterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = filterStore((state) => state.hasActiveFilters);

	return (
		<div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
			<div className="flex w-full items-center gap-2 px-4 lg:px-6">
				<div className="flex items-center gap-2 shrink-0">
					<TasksFilterPopover />
				</div>
				<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
					<TasksFilterChips />
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<TasksDisplaySettings />
					{hasActiveFilters() && (
						<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
