import type { TaskPriority, TaskStatus } from "@/data/types-new";
import { createFilterStore } from "@/store/shared-filter-factory";
import type { TasksFilters } from "./tasks-filter-types";
import { emptyTasksFilters } from "./tasks-filter-types";

export type TaskFilterType =
	| "status"
	| "priority"
	| "assignee"
	| "labels"
	| "parentType"
	| "owner"
	| "date";

function hasActiveFiltersFromFilters(filters: TasksFilters): boolean {
	return (
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.assignee.length > 0 ||
		filters.labels.length > 0 ||
		filters.owner.length > 0 ||
		filters.parentType.length > 0 ||
		filters.dateRange !== undefined
	);
}

function getActiveFiltersCountFromFilters(filters: TasksFilters): number {
	return (
		filters.status.length +
		filters.priority.length +
		filters.assignee.length +
		filters.labels.length +
		filters.owner.length +
		filters.parentType.length +
		(filters.dateRange ? 1 : 0)
	);
}

export const useTasksFilterStore = createFilterStore<
	TaskFilterType,
	TaskStatus | TaskPriority | string,
	TasksFilters
>({
	initialFilters: emptyTasksFilters,
	dateFilterType: "date",
	toggleFilterTypes: [
		"status",
		"priority",
		"assignee",
		"labels",
		"owner",
		"parentType",
	],
	hasActiveFilters: hasActiveFiltersFromFilters,
	getActiveFiltersCount: getActiveFiltersCountFromFilters,
});
