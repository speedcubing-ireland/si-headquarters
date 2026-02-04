import { useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryStates } from "nuqs";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useTasks } from "@/hooks/use-convex-data";
import {
	TasksPageProvider,
	TasksListStateContext,
	useTasksPageContext,
} from "@/store/tasks-page-context";
import { useListPageState } from "@/hooks/use-list-page-state";
import {
	useSyncTasksFiltersToUrl,
	initializeTasksStoreFromSearch,
} from "@/lib/route-state";
import { tasksFilterParsers } from "@/lib/nuqs-parsers";
import {
	bulkFilterItems,
	type MatchMode,
	type TaskPredicate,
} from "@/lib/task-filter-utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TasksDataTable } from "./data-table";
import { useTaskColumns } from "./columns";
import { TaskModal } from "./task-modal";
import { FilterBar } from "./filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import type { ReactNode } from "react";
import type { TasksPageConfig } from "@/store/create-tasks-page-store";
import {
	CreateViewProvider,
	ListPageLayout,
} from "@/components/shared/list-page-layout";

export type TasksPageProps = {
	// Identity
	pageId: string;
	pageTitle: string;
	pageIcon: LucideIcon;
	secondaryLabel?: string;

	// Data source
	taskSource?: "all" | "archived";

	// Page-level predicates (layer 2 from filtering strategy)
	pagePredicates?: TaskPredicate[];
	pagePredicateMode?: MatchMode;

	// Defaults for this page's store
	defaultFilters?: TasksPageConfig["defaultFilters"];
	defaultDisplaySettings?: TasksPageConfig["defaultDisplaySettings"];

	// UI options
	showCreateButton?: boolean;
	showClearButton?: boolean;

	// Extension slot for triage bar or other controls
	subHeader?: ReactNode;

	// Custom bulk actions slot (when provided, replaces default BulkActionsBar; component can use useTasksListStateContext())
	bulkActions?: ReactNode;
};

// Hook for keyboard shortcuts
function useTasksKeyboardShortcuts(
	listState: ReturnType<typeof useListPageState>,
	enableCreateShortcut = true,
) {
	// Cmd/Ctrl+C to create task
	useKeyboardShortcut({
		key: "c",
		handler: useCallback(
			() => listState.setModalOpen(true),
			[listState.setModalOpen],
		),
		enabled: enableCreateShortcut && !listState.hasSelection,
	});

	// Escape to clear selection
	useKeyboardShortcut({
		key: "Escape",
		handler: useCallback(
			() => listState.clearRowSelection(),
			[listState.clearRowSelection],
		),
		enabled: listState.hasSelection,
	});

	// Custom event handler for programmatic trigger
	useEffect(() => {
		const customHandler = () => {
			if (enableCreateShortcut) {
				listState.setModalOpen(true);
			}
		};

		window.addEventListener("create-task-shortcut", customHandler);
		return () => {
			window.removeEventListener("create-task-shortcut", customHandler);
		};
	}, [listState.setModalOpen, enableCreateShortcut]);
}

// Inner component that uses the context
function TasksPageInner(props: TasksPageProps) {
	const {
		pageTitle,
		pageIcon,
		secondaryLabel,
		taskSource = "all",
		pagePredicates = [],
		pagePredicateMode = "any",
		showCreateButton = true,
		subHeader,
	} = props;

	const { filterStore, displayStore, savedViews } = useTasksPageContext();

	const { tasks: allTasks } = useTasks(taskSource === "archived");

	// Get URL state using nuqs
	const [search] = useQueryStates(tasksFilterParsers);

	// Apply page predicates (layer 2)
	const pageTasks = useMemo(() => {
		if (pagePredicates.length === 0) return allTasks;
		return bulkFilterItems(allTasks, pagePredicateMode, pagePredicates);
	}, [allTasks, pagePredicates, pagePredicateMode]);

	// List page state
	const listState = useListPageState({
		filterStore,
		displayStore,
		savedViews,
	});

	// Keyboard handlers
	useTasksKeyboardShortcuts(listState, showCreateButton);

	// URL sync
	useSyncTasksFiltersToUrl({
		filterStore,
		displayStore,
		savedViews,
		activeViewId: savedViews.activeViewId,
	});

	// Initialize from URL search params (only once on mount)
	const initializedRef = useRef(false);
	useEffect(() => {
		if (!initializedRef.current) {
			initializeTasksStoreFromSearch(
				search as Parameters<typeof initializeTasksStoreFromSearch>[0],
				filterStore,
				displayStore,
				savedViews,
			);
			initializedRef.current = true;
		}
	}, [search, filterStore, displayStore, savedViews]);

	// Reset handler for primary button
	const handleReset = useCallback(() => {
		filterStore.getState().clearFilters();

		// Restore default display settings instead of clearing
		if (props.defaultDisplaySettings) {
			displayStore.getState().fromJSON(
				JSON.stringify({
					grouping: props.defaultDisplaySettings.grouping ?? null,
					subGrouping: props.defaultDisplaySettings.subGrouping ?? null,
					ordering: props.defaultDisplaySettings.ordering ?? {
						field: null,
						direction: "asc",
					},
				}),
			);
		} else {
			displayStore.getState().reset();
		}

		savedViews.setActiveView(null);
	}, [filterStore, displayStore, savedViews, props.defaultDisplaySettings]);

	const columns = useTaskColumns();

	const header = (
		<PageHeader.Root>
			<PageHeader.Primary
				icon={pageIcon}
				label={pageTitle}
				onClick={handleReset}
			/>
			{secondaryLabel ? (
				<>
					<Separator
						orientation="vertical"
						className="mx-2 data-[orientation=vertical]:h-4"
					/>
					<PageHeader.Secondary label={secondaryLabel} />
				</>
			) : null}

			<Separator
				orientation="vertical"
				className="mx-2 data-[orientation=vertical]:h-4"
			/>
			{savedViews.views.length > 0 ? (
				<PageHeader.Views
					views={savedViews.views}
					activeViewId={savedViews.activeViewId ?? null}
					onViewSelect={listState.handleViewSelect}
					onViewDelete={savedViews.deleteView}
				/>
			) : null}
			<PageHeader.NewView
				onClick={listState.handleStartCreateView}
				showLabel={savedViews.views.length === 0}
			/>

			<PageHeader.Actions>
				{showCreateButton ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => listState.setModalOpen(true)}
					>
						<Plus className="size-4" />
						Add task
					</Button>
				) : null}
				<SidebarTrigger />
			</PageHeader.Actions>
		</PageHeader.Root>
	);

	const filtersRow = <FilterBar />;

	const table = (
		<>
			{subHeader}
			<div className="px-4 lg:px-6">
				<TasksDataTable
					columns={columns}
					tasks={pageTasks}
					enableRowSelection={true}
					rowSelection={listState.rowSelection}
					onRowSelectionChange={listState.setRowSelection}
					autoHideRowSelection={true}
					skipClientFiltering={taskSource === "archived"}
				/>
			</div>
		</>
	);

	const handleSelectAll = useCallback(() => {
		const allSelected = pageTasks.reduce(
			(acc, task) => {
				acc[task.id] = true;
				return acc;
			},
			{} as Record<string, boolean>,
		);
		listState.setRowSelection(allSelected);
	}, [pageTasks, listState.setRowSelection]);

	const modal = (
		<>
			<TaskModal
				open={listState.modalOpen}
				onOpenChange={listState.setModalOpen}
				mode="create"
			/>

			{props.bulkActions ?? (
				<BulkActionsBar
					totalTasks={pageTasks.length}
					onSelectAll={handleSelectAll}
				/>
			)}
		</>
	);

	return (
		<TasksListStateContext.Provider value={listState}>
			<CreateViewProvider
				value={{
					isCreatingView: listState.isCreatingView,
					viewName: listState.viewName,
					setViewName: listState.setViewName,
					viewDescription: listState.viewDescription,
					setViewDescription: listState.setViewDescription,
					onCancelCreateView: listState.handleCancelCreateView,
					onSaveView: listState.handleSaveView,
				}}
			>
				<ListPageLayout
					header={header}
					filtersRow={filtersRow}
					table={table}
					modal={modal}
				/>
			</CreateViewProvider>
		</TasksListStateContext.Provider>
	);
}

// Main exported component with provider
export function TasksPage(props: TasksPageProps) {
	const { pageId, defaultFilters, defaultDisplaySettings } = props;

	return (
		<TasksPageProvider
			pageId={pageId}
			config={{ defaultFilters, defaultDisplaySettings }}
		>
			<TasksPageInner {...props} />
		</TasksPageProvider>
	);
}
