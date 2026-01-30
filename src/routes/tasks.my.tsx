import { createFileRoute } from "@tanstack/react-router";
import { ListTodo, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SharedPageHeader } from "@/components/shared/page-header";
import { BulkActionsBar } from "@/components/tasks/bulk-actions-bar";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TaskModal } from "@/components/tasks/task-modal";
import { Button } from "@/components/ui/button";
import { useDataV2 } from "@/data/data-store-v2";
import { useListPageState } from "@/hooks/use-list-page-state";
import type { Task } from "@/data/types-new";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { useTasksSavedViews } from "@/store/use-tasks-saved-views";
import {
	tasksSearchSchema,
	initializeTasksStoreFromSearch,
	useSyncTasksFiltersToUrl,
	stripSearchParams,
	myTasksDefaultSearch,
} from "@/lib/route-state";

export const Route = createFileRoute("/tasks/my")({
	validateSearch: tasksSearchSchema,
	search: {
		middlewares: [stripSearchParams(myTasksDefaultSearch(""))],
	},
	onLeave: () => {
		// Reset filters when actually leaving this route
		useTasksFilterStore.getState().clearFilters();
		useTasksDisplaySettingsStore.getState().fromJSON(
			JSON.stringify({
				grouping: null,
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
	},
	component: RouteComponent,
});

function PageHeader({
	onAddTask,
	onMyTasks,
}: {
	onAddTask: () => void;
	onMyTasks: () => void;
}) {
	return (
		<SharedPageHeader
			primaryIcon={ListTodo}
			primaryLabel="My tasks"
			addIcon={Plus}
			addLabel="Add task"
			onAdd={onAddTask}
			onPrimaryClick={onMyTasks}
		/>
	);
}

function Filters() {
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = useTasksFilterStore(
		(state) => state.hasActiveFilters,
	);

	return (
		<div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
			<div className="flex w-full items-center gap-2 px-4 lg:px-6">
				<div className="flex items-center gap-2 shrink-0">
					<TasksFilterPopover />
				</div>
				<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
					<TasksFilterChips />
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<TasksDisplaySettings />
					{hasActiveFilters() && (
						<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

function useCurrentUserTasks(): Task[] {
	const users = useDataV2((state) => state.users);
	const allTasks = useDataV2((state) => state.tasks);
	const currentUser = users[0];

	const mine = useMemo(
		() => allTasks.filter((task) => task.assignee?.id === currentUser?.id),
		[allTasks, currentUser?.id],
	);

	return mine;
}

function RouteComponent() {
	const columns = useTaskColumns();
	const myTasks = useCurrentUserTasks();
	const savedViews = useTasksSavedViews();
	const listState = useListPageState({
		filterStore: useTasksFilterStore,
		displayStore: useTasksDisplaySettingsStore,
		savedViews,
	});

	// Get current user for forced defaults
	const currentUser = useDataV2((state) => state.users[0]);

	// Get type-safe search params from URL
	const search = Route.useSearch();

	// Initialize filter/display stores from URL on mount with forced defaults
	useEffect(() => {
		initializeTasksStoreFromSearch(
			search,
			useTasksFilterStore,
			useTasksDisplaySettingsStore,
			savedViews,
			// Force assignee to current user, grouping to status
			currentUser
				? {
						assignee: [currentUser.id],
						grouping: "status",
					}
				: undefined,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync store changes back to URL
	useSyncTasksFiltersToUrl({
		filterStore: useTasksFilterStore,
		displayStore: useTasksDisplaySettingsStore,
		savedViews,
		activeViewId: savedViews.activeViewId,
	});

	// Keyboard shortcuts: C to create, Esc to clear selection
	useEffect(() => {
		const keyHandler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}

			// C - Create task (only when no selection)
			if (event.key.toLowerCase() === "c" && !listState.hasSelection) {
				event.preventDefault();
				listState.setModalOpen(true);
			}

			// Esc - Clear selection when tasks are selected
			if (event.key === "Escape" && listState.hasSelection) {
				event.preventDefault();
				listState.clearRowSelection();
			}
		};

		// Handle global custom event from command menu
		const customHandler = () => {
			listState.setModalOpen(true);
		};

		window.addEventListener("keydown", keyHandler);
		window.addEventListener("create-task-shortcut", customHandler);

		return () => {
			window.removeEventListener("keydown", keyHandler);
			window.removeEventListener("create-task-shortcut", customHandler);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		listState.setModalOpen,
		listState.hasSelection,
		listState.clearRowSelection,
	]);

	// Reset to default "My tasks" view state
	const handleResetToMyTasks = () => {
		const state = useTasksFilterStore.getState();
		state.clearFilters();
		if (currentUser) {
			state.setFilter("assignee", [currentUser.id]);
		}
		useTasksDisplaySettingsStore.getState().fromJSON(
			JSON.stringify({
				grouping: "status",
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<PageHeader
				onAddTask={() => listState.setModalOpen(true)}
				onMyTasks={handleResetToMyTasks}
			/>
			<Filters />
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 lg:px-6">
				<TasksDataTable
					columns={columns}
					tasks={myTasks}
					enableRowSelection={true}
					rowSelection={listState.rowSelection}
					onRowSelectionChange={listState.setRowSelection}
					autoHideRowSelection={true}
				/>
			</div>
			<TaskModal
				open={listState.modalOpen}
				onOpenChange={listState.setModalOpen}
				mode="create"
			/>
			<BulkActionsBar
				selectedTaskIds={listState.selectedIds}
				totalTasks={listState.selectedIds.length}
				onClearSelection={listState.clearRowSelection}
				onSelectAll={() => {}}
			/>
		</div>
	);
}
