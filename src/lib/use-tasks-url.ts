import type { TasksFilters } from "@/lib/filter-types";
import { emptyTasksFilters } from "@/lib/filter-types";
import type { DisplaySettings } from "@/lib/saved-view-utils";
import {
	createUrlHook,
	cloneFilterItems,
	cloneDateRange,
	type UrlState,
	type UrlActions,
} from "@/lib/create-url-hook";

export type TasksUrlState = UrlState<TasksFilters>;
export type TasksUrlActions = UrlActions<TasksFilters>;

export type UseTasksUrlOptions = {
	pageId: string;
	defaultFilters?: Partial<TasksFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
};

function cloneTasksFilters(filters: TasksFilters): TasksFilters {
	return {
		status: cloneFilterItems(filters.status),
		priority: cloneFilterItems(filters.priority),
		assignee: cloneFilterItems(filters.assignee),
		labels: cloneFilterItems(filters.labels),
		owner: cloneFilterItems(filters.owner),
		parentType: cloneFilterItems(filters.parentType),
		dateRange: cloneDateRange(filters.dateRange),
	};
}

function buildDefaultTasksFilters(
	partial: Partial<TasksFilters> | undefined,
	empty: TasksFilters,
): TasksFilters {
	return cloneTasksFilters({
		status: partial?.status ?? empty.status,
		priority: partial?.priority ?? empty.priority,
		assignee: partial?.assignee ?? empty.assignee,
		labels: partial?.labels ?? empty.labels,
		owner: partial?.owner ?? empty.owner,
		parentType: partial?.parentType ?? empty.parentType,
		dateRange: partial?.dateRange,
	});
}

export const useTasksUrl = createUrlHook<TasksFilters>({
	emptyFilters: emptyTasksFilters,
	cloneFilters: cloneTasksFilters,
	buildDefaultFilters: buildDefaultTasksFilters,
});
