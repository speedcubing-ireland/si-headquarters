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
	owner: FilterItem<string>[];
	parentType: FilterItem<"task" | "phase" | "competition">[];
	/**
	 * Optional date range applied to the task's due date. When present, tasks
	 * must have a dueDate that falls within this range to be included.
	 */
	dateRange?: DateRangeFilter;
};

export const emptyTasksFilters: TasksFilters = {
	status: [],
	priority: [],
	assignee: [],
	labels: [],
	owner: [],
	parentType: [],
	dateRange: undefined,
};
