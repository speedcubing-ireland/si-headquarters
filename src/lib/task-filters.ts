import type { Task } from "@/data/types-new";
import type {
	DateRangeFilter,
	MatchMode,
	TasksFilters,
} from "@/lib/filter-types";
import {
	buildFilterItemMatcher,
	hasDateRangeValue,
} from "./shared-filter-engine";

type FilterState = {
	filters: TasksFilters;
	matchMode: MatchMode;
};

export function hasActiveFilters(filters: TasksFilters): boolean {
	return (
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.assignee.length > 0 ||
		filters.labels.length > 0 ||
		filters.owner.length > 0 ||
		filters.parentType.length > 0 ||
		hasDateRangeValue(filters.dateRange)
	);
}

export function getActiveFiltersCount(filters: TasksFilters): number {
	let count =
		filters.status.length +
		filters.priority.length +
		filters.assignee.length +
		filters.labels.length +
		filters.owner.length +
		filters.parentType.length;
	if (hasDateRangeValue(filters.dateRange)) {
		count += 1;
	}
	return count;
}

function buildDateMatcher(
	dateRange?: DateRangeFilter,
): (task: Task) => boolean {
	if (!hasDateRangeValue(dateRange)) {
		return () => true;
	}

	return (task: Task) => {
		if (!dateRange || !hasDateRangeValue(dateRange)) return true;

		const { start, end, isNot } = dateRange;
		const dueDate = task.dueDate ? new Date(task.dueDate) : null;
		const startDate = start ? new Date(start) : null;
		const endDate = end ? new Date(end) : null;

		const matchesDateRange =
			!!dueDate &&
			(!startDate || dueDate >= startDate) &&
			(!endDate || dueDate <= endDate);

		return isNot ? !matchesDateRange : matchesDateRange;
	};
}

export function filterTasksWithState(
	tasks: Task[],
	filterState: FilterState,
): Task[] {
	const { matchMode = "all", filters } = filterState;
	return filterTasks(tasks, filters, matchMode);
}

function filterTasks(
	tasks: Task[],
	filters: TasksFilters,
	matchMode: MatchMode,
): Task[] {
	const hasStatus = filters.status.length > 0;
	const hasPriority = filters.priority.length > 0;
	const hasAssignee = filters.assignee.length > 0;
	const hasLabels = filters.labels.length > 0;
	const hasOwner = filters.owner.length > 0;
	const hasParentType = filters.parentType.length > 0;
	const hasDate = hasDateRangeValue(filters.dateRange);

	if (
		!hasStatus &&
		!hasPriority &&
		!hasAssignee &&
		!hasLabels &&
		!hasOwner &&
		!hasParentType &&
		!hasDate
	) {
		return tasks;
	}

	const matchesStatus = buildFilterItemMatcher(
		filters.status,
		(t: Task) => t.status,
		matchMode,
	);
	const matchesPriority = buildFilterItemMatcher(
		filters.priority,
		(t: Task) => t.priority,
		matchMode,
	);
	const matchesAssignee = buildFilterItemMatcher(
		filters.assignee,
		(t: Task) => t.assignee?.id,
		matchMode,
	);
	const matchesLabels = buildFilterItemMatcher(
		filters.labels,
		(t: Task) => t.labels.map((l) => l.id),
		matchMode,
	);
	const matchesOwner = buildFilterItemMatcher(
		filters.owner,
		(t: Task) =>
			t.owner && "id" in t.owner ? (t.owner as { id: string }).id : undefined,
		matchMode,
	);
	const matchesParentType = buildFilterItemMatcher(
		filters.parentType,
		(t: Task) => t.parent?.type,
		matchMode,
	);
	const matchesDate = buildDateMatcher(filters.dateRange);

	const potentialMatchers: Array<((task: Task) => boolean) | false> = [
		hasStatus && matchesStatus,
		hasPriority && matchesPriority,
		hasAssignee && matchesAssignee,
		hasLabels && matchesLabels,
		hasOwner && matchesOwner,
		hasParentType && matchesParentType,
		hasDate && matchesDate,
	];

	const activeMatchers = potentialMatchers.filter(
		(matcher): matcher is (task: Task) => boolean => Boolean(matcher),
	);

	if (activeMatchers.length === 0) {
		return tasks;
	}

	return tasks.filter((task) =>
		matchMode === "all"
			? activeMatchers.every((matcher) => matcher(task))
			: activeMatchers.some((matcher) => matcher(task)),
	);
}
