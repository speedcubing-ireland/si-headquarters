import type { TaskPriority, TaskStatus } from "@/data/types-new";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/shared-filter-types";

export type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
	TaskPriority,
	TaskStatus,
};

export type TasksFilters = {
	status: FilterItem<TaskStatus>[];
	priority: FilterItem<TaskPriority>[];
	assignee: FilterItem<string>[];
	labels: FilterItem<string>[];
	parentType: FilterItem<"task" | "phase" | "competition">[];
	dateRange?: DateRangeFilter;
};

export const emptyTasksFilters: TasksFilters = {
	status: [],
	priority: [],
	assignee: [],
	labels: [],
	parentType: [],
	dateRange: undefined,
};
