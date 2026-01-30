import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";
import { filterTasksWithState } from "@/lib/task-filters";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";

interface TasksDataTableProps {
	columns: ColumnDef<Task>[];
	/**
	 * Optional pre-filtered list of tasks. When provided, the table will render
	 * this subset instead of all tasks from the global store. This is used by
	 * views such as the competition detail page to scope tasks.
	 */
	tasks?: Task[];
	/**
	 * Enable row selection functionality.
	 */
	enableRowSelection?: boolean;
	/**
	 * Callback when selected tasks change. Returns array of selected task IDs.
	 * @deprecated Use rowSelection and onRowSelectionChange for controlled mode
	 */
	onSelectionChange?: (selectedTaskIds: string[]) => void;
	/**
	 * Controlled row selection state (TanStack Table format: { rowId: boolean }).
	 * When provided, component operates in controlled mode.
	 */
	rowSelection?: Record<string, boolean>;
	/**
	 * Callback when row selection changes (for controlled mode).
	 */
	onRowSelectionChange?: (rowSelection: Record<string, boolean>) => void;
	/**
	 * When true, checkboxes are hidden until row is hovered or any row is selected.
	 */
	autoHideRowSelection?: boolean;
	/**
	 * When true, skips client-side filtering (useful for pages that provide pre-filtered data like archived tasks).
	 * Grouping and sorting are still applied.
	 */
	skipClientFiltering?: boolean;
}

export function TasksDataTable({
	columns,
	tasks: overrideTasks,
	enableRowSelection = false,
	onSelectionChange,
	rowSelection,
	onRowSelectionChange,
	autoHideRowSelection = false,
	skipClientFiltering = false,
}: TasksDataTableProps) {
	// Use individual atomic selectors - Zustand v4+ handles multiple subscriptions efficiently
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
	const tableRef = useRef<HTMLDivElement>(null);

	const filterState = useMemo(
		() => ({ filters, matchMode }),
		[filters, matchMode],
	);

	const filterFn: SharedDataTableProps<Task, typeof filterState>["filterFn"] =
		useMemo(
			() =>
				skipClientFiltering
					? (rows: Task[]) => rows
					: (rows: Task[], state: typeof filterState) =>
							filterTasksWithState(rows, state),
			[skipClientFiltering],
		);

	const handleSelectionChange = useCallback(
		(selectedTasks: Task[]) => {
			if (onSelectionChange) {
				onSelectionChange(selectedTasks.map((task) => task.id));
			}
		},
		[onSelectionChange],
	);

	const getRowId = useCallback((task: Task) => task.id, []);

	// Handle Cmd/Ctrl+A to select all visible tasks
	useEffect(() => {
		if (!enableRowSelection) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Check for Cmd+A (Mac) or Ctrl+A (Windows/Linux)
			if ((e.metaKey || e.ctrlKey) && e.key === "a") {
				// Check if the table has focus or if user is not in an input
				const activeElement = document.activeElement;
				const isInputFocused =
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement ||
					activeElement instanceof HTMLSelectElement;

				if (!isInputFocused) {
					e.preventDefault();
					// Dispatch a custom event that SharedDataTable can listen to
					const selectAllEvent = new CustomEvent("datatable-select-all", {
						bubbles: true,
					});
					tableRef.current?.dispatchEvent(selectAllEvent);
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enableRowSelection]);

	return (
		<div ref={tableRef}>
			<SharedDataTable<Task, typeof filterState>
				columns={columns as ColumnDef<Task, unknown>[]}
				data={tasks}
				filterState={filterState}
				filterFn={filterFn}
				grouping={grouping}
				subGrouping={subGrouping}
				ordering={ordering}
				setOrdering={setOrdering}
				containerClassName="px-1"
				cellPaddingXClassName="px-1"
				showHeader={false}
				emptyLabel="No tasks found."
				onRowClick={(task) =>
					router.navigate({
						to: "/tasks/$id",
						params: { id: task.id },
					})
				}
				enableRowSelection={enableRowSelection}
				onSelectionChange={handleSelectionChange}
				getRowId={getRowId}
				rowSelection={rowSelection}
				onRowSelectionChange={onRowSelectionChange}
				autoHideRowSelection={autoHideRowSelection}
			/>
		</div>
	);
}
