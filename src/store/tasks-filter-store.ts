import type { TaskPriority, TaskStatus } from "@/data/types-new";
import { getActiveFiltersCount, hasActiveFilters } from "@/lib/task-filters";
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
	hasActiveFilters,
	getActiveFiltersCount,
});
