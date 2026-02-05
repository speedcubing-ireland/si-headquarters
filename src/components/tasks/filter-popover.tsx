import { useState } from "react";
import { SharedFilterPopover } from "@/components/shared/filters/filter-popover";
import { useTaskFilterContext } from "@/hooks/use-task-filter-context";
import {
	TASK_FILTER_TYPES,
	getFilterValues,
} from "@/lib/task-filter-definitions";
import { useTasksPageContext } from "@/store/tasks-page-context";
import { TasksFilterSubMenu } from "./filter-sub-menu";

export function TasksFilterPopover() {
	const { filterStore } = useTasksPageContext();
	const filterContext = useTaskFilterContext();
	const filters = filterStore((state) => state.filters);
	const toggleFilter = filterStore((state) => state.toggleFilter);
	const clearFilters = filterStore((state) => state.clearFilters);
	const getActiveFiltersCount = filterStore(
		(state) => state.getActiveFiltersCount,
	);
	const [open, setOpen] = useState(false);

	const handleToggleFilter = (type: string, value: string) => {
		toggleFilter(type as "status" | "priority" | "assignee" | "labels", value);
		setOpen(false);
	};

	const getSelectedValues = (type: string): string[] => {
		const items = filters[type as keyof typeof filters] as
			| { values: string[] }[]
			| undefined;
		return items ? items.flatMap((i) => i.values) : [];
	};

	return (
		<SharedFilterPopover
			count={getActiveFiltersCount()}
			onClear={clearFilters}
			open={open}
			onOpenChange={setOpen}
		>
			{TASK_FILTER_TYPES.map((filterType) => {
				const options = getFilterValues(filterType.id, filterContext);
				return (
					<TasksFilterSubMenu
						key={filterType.id}
						filterType={filterType}
						filterCount={
							(
								filters[filterType.id as keyof typeof filters] as
									| unknown[]
									| undefined
							)?.length ?? 0
						}
						options={options}
						selectedValues={getSelectedValues(filterType.id)}
						onToggleFilter={handleToggleFilter}
					/>
				);
			})}
		</SharedFilterPopover>
	);
}
