import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
	TasksFilters,
} from "@/store/tasks-filter-types";

type FilterState = {
	filters: TasksFilters;
	matchMode: MatchMode;
};

function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
	return !!dateRange && (!!dateRange.start || !!dateRange.end);
}

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

function buildFilterItemMatcher<T>(
	filterItems: FilterItem<T>[],
	getTaskValue: (task: Task) => T | T[] | undefined,
	matchMode: MatchMode,
): (task: Task) => boolean {
	if (filterItems.length === 0) {
		return () => true;
	}

	return (task: Task) => {
		const raw = getTaskValue(task);
		const taskValues: T[] =
			raw === undefined ? ([] as T[]) : Array.isArray(raw) ? raw : [raw];

		const matchesValues = (values: T[]) =>
			taskValues.some((v) => values.includes(v));

		const positiveItems = filterItems.filter((item) => !item.isNot);
		const negativeItems = filterItems.filter((item) => item.isNot);

		const positiveMatch =
			positiveItems.length === 0
				? true
				: matchMode === "all"
					? positiveItems.every((item) => matchesValues(item.values))
					: positiveItems.some((item) => matchesValues(item.values));

		const negativeMatch = negativeItems.every(
			(item) => !matchesValues(item.values),
		);

		return positiveMatch && negativeMatch;
	};
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

export function filterTasks(
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

	const matchesStatus = buildFilterItemMatcher<TaskStatus>(
		filters.status,
		(t) => t.status,
		matchMode,
	);
	const matchesPriority = buildFilterItemMatcher<TaskPriority>(
		filters.priority,
		(t) => t.priority,
		matchMode,
	);
	const matchesAssignee = buildFilterItemMatcher<string>(
		filters.assignee,
		(t) => t.assignee?.id,
		matchMode,
	);
	const matchesLabels = buildFilterItemMatcher<string>(
		filters.labels,
		(t) => t.labels.map((l) => l.id),
		matchMode,
	);
	const matchesOwner = buildFilterItemMatcher<string>(
		filters.owner,
		(t) =>
			t.owner && "id" in t.owner ? (t.owner as { id: string }).id : undefined,
		matchMode,
	);
	const matchesParentType = buildFilterItemMatcher<
		"task" | "phase" | "competition"
	>(filters.parentType, (t) => t.parent?.type, matchMode);
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

	return tasks.filter((task) => {
		if (matchMode === "all") {
			return activeMatchers.every((matcher) => matcher(task));
		}
		return activeMatchers.some((matcher) => matcher(task));
	});
}
