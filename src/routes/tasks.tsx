import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ListTodo, Plus } from "lucide-react";
import { useEffect } from "react";
import { ListPageLayout } from "@/components/shared/list-page-layout";
import { SharedPageHeader } from "@/components/shared/page-header";
import { BulkActionsBar } from "@/components/tasks/bulk-actions-bar";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TasksDisplaySettings } from "@/components/tasks/display-settings";
import { TasksFilterChips } from "@/components/tasks/filter-chips";
import { TasksFilterPopover } from "@/components/tasks/filter-popover";
import { TaskModal } from "@/components/tasks/task-modal";
import { Button } from "@/components/ui/button";
import { useIsDetailRoute } from "@/hooks/use-is-detail-route";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { useTasksSavedViews } from "@/store/use-tasks-saved-views";
import {
	tasksSearchSchema,
	initializeTasksStoreFromSearch,
	useSyncTasksFiltersToUrl,
	stripSearchParams,
	defaultTasksSearch,
} from "@/lib/route-state";

export const Route = createFileRoute("/tasks")({
	validateSearch: tasksSearchSchema,
	search: {
		middlewares: [stripSearchParams(defaultTasksSearch)],
	},
	onLeave: () => {
		// Reset filters when actually leaving this route (not on hover)
		// Only reset if navigating to a non-child route
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
	views,
	activeViewId,
	onViewSelect,
	onViewDelete,
	onStartCreateView,
	onAllTasks,
}: {
	onAddTask: () => void;
	views: ReturnType<typeof useTasksSavedViews>["views"];
	activeViewId: string | null;
	onViewSelect: (viewId: string) => void;
	onViewDelete: (viewId: string) => void;
	onStartCreateView: () => void;
	onAllTasks: () => void;
}) {
	return (
		<SharedPageHeader
			primaryIcon={ListTodo}
			primaryLabel="All tasks"
			addIcon={Plus}
			addLabel="Add task"
			onAdd={onAddTask}
			onPrimaryClick={onAllTasks}
			views={views}
			activeViewId={activeViewId}
			onViewSelect={onViewSelect}
			onViewDelete={onViewDelete}
			onStartCreateView={onStartCreateView}
		/>
	);
}

function FiltersContent() {
	const matchMode = useTasksFilterStore((state) => state.matchMode);
	const toggleMatchMode = useTasksFilterStore((state) => state.toggleMatchMode);
	const hasActiveFilters = useTasksFilterStore(
		(state) => state.hasActiveFilters,
	);

	return (
		<>
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
		</>
	);
}

function RouteComponent() {
	const columns = useTaskColumns();
	const savedViews = useTasksSavedViews();
	const listState = useListPageState({
		filterStore: useTasksFilterStore,
		displayStore: useTasksDisplaySettingsStore,
		savedViews,
	});

	// Get type-safe search params from URL
	const search = Route.useSearch();

	// Initialize filter/display stores from URL on mount
	useEffect(() => {
		initializeTasksStoreFromSearch(
			search,
			useTasksFilterStore,
			useTasksDisplaySettingsStore,
			savedViews,
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

	const isDetailRoute = useIsDetailRoute("tasks");

	useEffect(() => {
		// Handle direct keyboard shortcut
		const keyHandler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}

			// C - Create task
			if (event.key.toLowerCase() === "c" && !listState.hasSelection) {
				event.preventDefault();
				listState.setModalOpen(true);
			}

			// Esc - Clear selection when tasks are selected
			if (event.key === "Escape" && listState.hasSelection) {
				event.preventDefault();
				listState.clearRowSelection();
			}

			// X - Toggle selection on highlighted row (handled in data-table)
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
		// Include full selection state dependencies to prevent stale closure
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		listState.setModalOpen,
		listState.hasSelection,
		listState.clearRowSelection,
	]);

	if (isDetailRoute) {
		return <Outlet />;
	}

	return (
		<>
			<ListPageLayout
				header={
					<PageHeader
						onAddTask={() => listState.setModalOpen(true)}
						views={savedViews.views}
						activeViewId={savedViews.activeViewId}
						onViewSelect={listState.handleViewSelect}
						onViewDelete={savedViews.deleteView}
						onStartCreateView={listState.handleStartCreateView}
						onAllTasks={listState.handleResetAll}
					/>
				}
				filtersRow={<FiltersContent />}
				table={
					<TasksDataTable
						columns={columns}
						enableRowSelection={true}
						rowSelection={listState.rowSelection}
						onRowSelectionChange={listState.setRowSelection}
						autoHideRowSelection={true}
					/>
				}
				modal={
					<TaskModal
						open={listState.modalOpen}
						onOpenChange={listState.setModalOpen}
						mode="create"
					/>
				}
				createView={{
					isCreatingView: listState.isCreatingView,
					viewName: listState.viewName,
					setViewName: listState.setViewName,
					viewDescription: listState.viewDescription,
					setViewDescription: listState.setViewDescription,
					onCancelCreateView: listState.handleCancelCreateView,
					onSaveView: listState.handleSaveView,
				}}
			/>
			<BulkActionsBar
				selectedTaskIds={listState.selectedIds}
				totalTasks={listState.selectedIds.length}
				onClearSelection={listState.clearRowSelection}
				onSelectAll={() => {}}
			/>
		</>
	);
}
