import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useRef, useCallback } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useTasks } from "@/hooks/use-convex-data";
import type { Task } from "@/data/types-new";
import { filterTasksWithState } from "@/lib/task-filters";
import type { TasksFilters, MatchMode } from "@/lib/filter-types";

interface TasksDataTableProps {
	columns: ColumnDef<Task, unknown>[];
	tasks?: Task[];
	filters: TasksFilters;
	matchMode: MatchMode;
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
	onOrderingChange: (field: string | null, direction: "asc" | "desc") => void;
	enableRowSelection?: boolean;
	rowSelection?: Record<string, boolean>;
	onRowSelectionChange?: (rowSelection: Record<string, boolean>) => void;
	autoHideRowSelection?: boolean;
	skipClientFiltering?: boolean;
}

export function TasksDataTable({
	columns,
	tasks: overrideTasks,
	filters,
	matchMode,
	grouping,
	subGrouping,
	ordering,
	onOrderingChange,
	enableRowSelection = false,
	rowSelection,
	onRowSelectionChange,
	autoHideRowSelection = false,
	skipClientFiltering = false,
}: TasksDataTableProps) {
	const filterState = useMemo(
		() => ({ filters, matchMode }),
		[filters, matchMode],
	);

	const displaySettings = useMemo(
		() => ({ grouping, subGrouping, ordering }),
		[grouping, subGrouping, ordering],
	);

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
				columns={columns}
				data={tasks}
				filterState={filterState}
				filterFn={filterFn}
				getRowId={(task) => task.id}
				grouping={displaySettings.grouping}
				subGrouping={displaySettings.subGrouping}
				ordering={displaySettings.ordering}
				setOrdering={onOrderingChange}
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
