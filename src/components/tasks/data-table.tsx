import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task, TaskPriority, TaskStatus } from "@/data/types-new";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import type {
	FilterItem,
	MatchMode,
	TasksFilters,
} from "@/store/tasks-filter-types";

interface TasksDataTableProps {
	columns: ColumnDef<Task>[];
	/**
	 * Optional pre-filtered list of tasks. When provided, the table will render
	 * this subset instead of all tasks from the global store. This is used by
	 * views such as the competition detail page to scope tasks.
	 */
	tasks?: Task[];
}

function filterTasks(
	tasks: Task[],
	filters: TasksFilters,
	matchMode: MatchMode,
): Task[] {
	const hasFilters =
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.assignee.length > 0 ||
		filters.labels.length > 0 ||
		filters.owner.length > 0 ||
		filters.parentType.length > 0 ||
		filters.dateRange !== undefined;

	if (!hasFilters) return tasks;

	const matchesFilterItems = <T,>(
		items: FilterItem<T>[],
		getTaskValue: (task: Task) => T | T[] | undefined,
	): ((task: Task) => boolean) => {
		if (items.length === 0) return () => true;

		return (task) => {
			const raw = getTaskValue(task);
			const taskValues: T[] =
				raw === undefined ? ([] as T[]) : Array.isArray(raw) ? raw : [raw];

			const positive = items.filter((i) => !i.isNot);
			const negative = items.filter((i) => i.isNot);

			const matchesValues = (values: T[]) =>
				taskValues.some((v) => values.includes(v));

			const positiveMatch =
				positive.length === 0
					? true
					: matchMode === "all"
						? positive.every((i) => matchesValues(i.values))
						: positive.some((i) => matchesValues(i.values));

			const negativeMatch = negative.every((i) => !matchesValues(i.values));

			return positiveMatch && negativeMatch;
		};
	};

	const filtered = tasks.filter((task) => {
		const checks: boolean[] = [];

		if (filters.status.length > 0) {
			checks.push(
				matchesFilterItems<TaskStatus>(filters.status, (t) => t.status)(task),
			);
		}

		if (filters.priority.length > 0) {
			checks.push(
				matchesFilterItems<TaskPriority>(
					filters.priority,
					(t) => t.priority,
				)(task),
			);
		}

		if (filters.assignee.length > 0) {
			checks.push(
				matchesFilterItems<string>(
					filters.assignee,
					(t) => t.assignee?.id,
				)(task),
			);
		}

		if (filters.labels.length > 0) {
			checks.push(
				matchesFilterItems<string>(filters.labels, (t) =>
					t.labels.map((l) => l.id),
				)(task),
			);
		}

		if (filters.owner.length > 0) {
			checks.push(
				matchesFilterItems<string>(filters.owner, (t) =>
					t.owner && "id" in t.owner
						? (t.owner as { id: string }).id
						: undefined,
				)(task),
			);
		}

		if (filters.parentType.length > 0) {
			checks.push(
				matchesFilterItems<"task" | "phase" | "competition">(
					filters.parentType,
					(t) => t.parent?.type,
				)(task),
			);
		}

		if (filters.dateRange) {
			const { start, end, isNot } = filters.dateRange;
			const dueDate = task.dueDate ? new Date(task.dueDate) : null;
			const startDate = start ? new Date(start) : null;
			const endDate = end ? new Date(end) : null;

			// Tasks without a due date never match a positive due date range filter.
			let matchesDateRange =
				!!dueDate &&
				(!startDate || dueDate >= startDate) &&
				(!endDate || dueDate <= endDate);

			if (isNot) {
				matchesDateRange = !matchesDateRange;
			}

			checks.push(matchesDateRange);
		}

		return matchMode === "any" ? checks.some(Boolean) : checks.every(Boolean);
	});

	return filtered;
}

export function TasksDataTable({
	columns,
	tasks: overrideTasks,
}: TasksDataTableProps) {
	const filters = useTasksFilterStore((state) => state.filters);
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const grouping = useTasksDisplaySettingsStore((state) => state.grouping);
	const subGrouping = useTasksDisplaySettingsStore(
		(state) => state.subGrouping,
	);
	const ordering = useTasksDisplaySettingsStore((state) => state.ordering);
	const setOrdering = useTasksDisplaySettingsStore(
		(state) => state.setOrdering,
	);
	const router = useRouter();
	const storeTasks = useDataV2((state) => state.tasks);
	const tasks = overrideTasks ?? storeTasks;

	const filterState = useMemo(
		() => ({ filters, matchMode }),
		[filters, matchMode],
	);

	const filterFn: SharedDataTableProps<
		Task,
		unknown,
		typeof filterState
	>["filterFn"] = useMemo(
		() => (rows: Task[], state: typeof filterState) =>
			filterTasks(rows, state.filters, state.matchMode as "any" | "all"),
		[],
	);

	return (
		<SharedDataTable<Task, unknown, typeof filterState>
			columns={columns as ColumnDef<Task, unknown>[]}
			data={tasks}
			filterState={filterState}
			filterFn={filterFn}
			grouping={grouping}
			subGrouping={subGrouping}
			ordering={ordering}
			setOrdering={setOrdering}
			containerClassName="px-4"
			cellPaddingXClassName="px-1"
			showHeader={false}
			emptyLabel="No tasks found."
			onRowClick={(task) =>
				router.navigate({
					to: "/tasks/$id",
					params: { id: task.id },
				})
			}
		/>
	);
}
