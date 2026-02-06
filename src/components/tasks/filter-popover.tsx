import { useState } from "react";
import { SharedFilterPopover } from "@/components/shared/filters/filter-popover";
import { useTaskFilterContext } from "@/hooks/use-task-filter-context";
import {
	TASK_FILTER_TYPES,
	getFilterValues,
} from "@/lib/task-filter-definitions";
import { useTasksUrlContext } from "@/lib/tasks-url-context";
import { TasksFilterSubMenu } from "./filter-sub-menu";
import type { TasksFilters } from "@/lib/filter-types";

export function TasksFilterPopover() {
	const urlState = useTasksUrlContext();
	const filterContext = useTaskFilterContext();
	const { filters, setArrayFilter, clearFilters } = urlState;
	const [open, setOpen] = useState(false);

	type ArrayFilterKey = Exclude<keyof TasksFilters, "dateRange">;

	const isArrayFilterKey = (type: string): type is ArrayFilterKey => {
		switch (type) {
			case "status":
			case "priority":
			case "assignee":
			case "labels":
			case "owner":
			case "parentType":
				return true;
			default:
				return false;
		}
	};

	const handleToggleFilter = (type: string, value: string) => {
		if (!isArrayFilterKey(type)) return;
		const currentValues = filters[type];
		const existingItem = currentValues?.find((item) =>
			item.values.includes(value),
		);

		if (existingItem) {
			const newValues = existingItem.values.filter((v) => v !== value);
			if (newValues.length === 0) {
				const newFilterValues = (currentValues || []).filter(
					(item) => !item.values.includes(value),
				);
				setArrayFilter(type, newFilterValues);
			} else {
				const newFilterValues = (currentValues || []).map((item) =>
					item.values.includes(value) ? { ...item, values: newValues } : item,
				);
				setArrayFilter(type, newFilterValues);
			}
		} else {
			const newFilterValues = [
				...(currentValues || []),
				{ values: [value], isNot: false },
			];
			setArrayFilter(type, newFilterValues);
		}
		setOpen(false);
	};

	const getSelectedValues = (type: string): string[] => {
		if (!isArrayFilterKey(type)) return [];
		const items = filters[type];
		return items ? items.flatMap((i) => i.values) : [];
	};

	const getActiveFiltersCount = () => {
		return (
			filters.status.length +
			filters.priority.length +
			filters.assignee.length +
			filters.labels.length +
			filters.owner.length +
			filters.parentType.length +
			(filters.dateRange ? 1 : 0)
		);
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
							isArrayFilterKey(filterType.id)
								? filters[filterType.id].length
								: 0
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
