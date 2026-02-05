import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useRef, useContext, useCallback } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useTasks } from "@/hooks/use-convex-data";
import type { Task } from "@/data/types-new";
import { filterTasksWithState } from "@/lib/task-filters";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { TasksPageContext } from "@/store/tasks-page-context";

interface TasksDataTableProps {
	columns: ColumnDef<Task>[];
	tasks?: Task[];
	enableRowSelection?: boolean;
	rowSelection?: Record<string, boolean>;
	onRowSelectionChange?: (rowSelection: Record<string, boolean>) => void;
	autoHideRowSelection?: boolean;
	skipClientFiltering?: boolean;
}

function useTasksStores() {
	const context = useContext(TasksPageContext);

	if (context) {
		return {
			filterStore: context.filterStore,
			displayStore: context.displayStore,
			source: "context" as const,
		};
	}

	return {
		filterStore: useTasksFilterStore,
		displayStore: useTasksDisplaySettingsStore,
		source: "global" as const,
	};
}

export function TasksDataTable({
	columns,
	tasks: overrideTasks,
	enableRowSelection = false,
	rowSelection,
	onRowSelectionChange,
	autoHideRowSelection = false,
	skipClientFiltering = false,
}: TasksDataTableProps) {
	const { filterStore, displayStore } = useTasksStores();

	const filters = filterStore((state) => state.filters);
	const matchMode = filterStore((state) => state.matchMode);
	const filterState = useMemo(
		() => ({ filters, matchMode }),
		[filters, matchMode],
	);

	const grouping = displayStore((state) => state.grouping);
	const subGrouping = displayStore((state) => state.subGrouping);
	const ordering = displayStore((state) => state.ordering);
	const displaySettings = useMemo(
		() => ({ grouping, subGrouping, ordering }),
		[grouping, subGrouping, ordering],
	);
	const setOrdering = displayStore((state) => state.setOrdering);

	const router = useRouter();
	const { tasks: storeTasks } = useTasks(false);
	const tasks = overrideTasks ?? storeTasks;
	const tableRef = useRef<HTMLDivElement>(null);

	const filterFn: SharedDataTableProps<Task, typeof filterState>["filterFn"] =
		useMemo(
			() =>
				skipClientFiltering
					? (rows: Task[]) => rows
					: (rows: Task[], state: typeof filterState) =>
							filterTasksWithState(rows, state),
			[skipClientFiltering],
		);

	const handleRowClick = useCallback(
		(task: Task) => {
			router.navigate({
				to: "/tasks/$id",
				params: { id: task.id },
			});
		},
		[router],
	);

	return (
		<div ref={tableRef}>
			<SharedDataTable<Task, typeof filterState>
				columns={columns as ColumnDef<Task, unknown>[]}
				data={tasks}
				filterState={filterState}
				filterFn={filterFn}
				getRowId={(task) => task.id}
				grouping={displaySettings.grouping}
				subGrouping={displaySettings.subGrouping}
				ordering={displaySettings.ordering}
				setOrdering={setOrdering}
				containerClassName=""
				cellPaddingXClassName="px-1"
				showHeader={false}
				emptyLabel="No tasks found."
				onRowClick={handleRowClick}
				enableRowSelection={enableRowSelection}
				rowSelection={rowSelection}
				onRowSelectionChange={onRowSelectionChange}
				autoHideRowSelection={autoHideRowSelection}
			/>
		</div>
	);
}
