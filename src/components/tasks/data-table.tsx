import { useRouter } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useContext } from "react";
import {
	SharedDataTable,
	type SharedDataTableProps,
} from "@/components/shared/data-table";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";
import { filterTasksWithState } from "@/lib/task-filters";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { TasksPageContext } from "@/store/tasks-page-context";

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

// Hook to safely get stores from context or fallback to global
function useTasksStores() {
	const context = useContext(TasksPageContext);

	if (context) {
		// Inside TasksPage - use context stores
		return {
			filterStore: context.filterStore,
			displayStore: context.displayStore,
			source: "context" as const,
		};
	}

	// Outside TasksPage - use global stores (for backward compatibility)
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
	const grouping = displayStore((state) => state.grouping);
	const subGrouping = displayStore((state) => state.subGrouping);
	const ordering = displayStore((state) => state.ordering);
	const setOrdering = displayStore((state) => state.setOrdering);

	const filterState = useMemo(
		() => ({ filters, matchMode }),
		[filters, matchMode],
	);

	const router = useRouter();
	const storeTasks = useDataV2((state) => state.tasks);
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

	// Handle Cmd/Ctrl+A to select all visible tasks
	useEffect(() => {
		if (!enableRowSelection) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "a") {
				const activeElement = document.activeElement;
				const isInputFocused =
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement ||
					activeElement instanceof HTMLSelectElement;

				if (!isInputFocused) {
					e.preventDefault();
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
				rowSelection={rowSelection}
				onRowSelectionChange={onRowSelectionChange}
				autoHideRowSelection={autoHideRowSelection}
			/>
		</div>
	);
}
