import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useDataV2 } from "@/data/data-store-v2";
import {
	TasksPageProvider,
	useTasksPageContext,
} from "@/store/tasks-page-context";
import { useListPageState } from "@/hooks/use-list-page-state";
import {
	useSyncTasksFiltersToUrl,
	initializeTasksStoreFromSearch,
} from "@/lib/route-state";
import type { TasksSearchParams } from "@/lib/route-search-params";
import {
	bulkFilterItems,
	type MatchMode,
	type TaskPredicate,
} from "@/lib/task-filter-utils";
import { SharedPageHeader } from "@/components/shared/page-header";
import { TasksDataTable } from "./data-table";
import { useTaskColumns } from "./columns";
import { TaskModal } from "./task-modal";
import { FilterBar } from "./filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import type { ReactNode } from "react";
import type { TasksPageConfig } from "@/store/create-tasks-page-store";

export interface ListState {
	selectedIds: string[];
	clearRowSelection: () => void;
	setModalOpen: (open: boolean) => void;
	modalOpen: boolean;
	hasSelection: boolean;
	rowSelection: Record<string, boolean>;
	setRowSelection: (
		updater:
			| Record<string, boolean>
			| ((prev: Record<string, boolean>) => Record<string, boolean>),
	) => void;
}

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

	// Custom bulk actions (replaces default BulkActionsBar)
	renderBulkActions?: (listState: ListState) => ReactNode;

	// Route search params for URL sync
	search?: TasksSearchParams;
};

// Hook for keyboard shortcuts
function useTasksKeyboardShortcuts(
	listState: ReturnType<typeof useListPageState>,
	enableCreateShortcut = true,
) {
	useEffect(() => {
		const keyHandler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
				return;
			}

			if (
				event.key.toLowerCase() === "c" &&
				!listState.hasSelection &&
				enableCreateShortcut
			) {
				event.preventDefault();
				listState.setModalOpen(true);
			}

			if (event.key === "Escape" && listState.hasSelection) {
				event.preventDefault();
				listState.clearRowSelection();
			}
		};

		const customHandler = () => {
			if (enableCreateShortcut) {
				listState.setModalOpen(true);
			}
		};

		window.addEventListener("keydown", keyHandler);
		window.addEventListener("create-task-shortcut", customHandler);

		return () => {
			window.removeEventListener("keydown", keyHandler);
			window.removeEventListener("create-task-shortcut", customHandler);
		};
	}, [
		listState.setModalOpen,
		listState.hasSelection,
		listState.clearRowSelection,
		enableCreateShortcut,
	]);
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
		search,
	} = props;

	const { filterStore, displayStore, savedViews } = useTasksPageContext();

	// Get data from store
	const allTasks = useDataV2((s) =>
		taskSource === "archived" ? s.archivedTasks : s.tasks,
	);

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

	// Initialize from URL search params
	useEffect(() => {
		if (search) {
			initializeTasksStoreFromSearch(
				search,
				filterStore,
				displayStore,
				savedViews,
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Reset handler for primary button
	const handleReset = () => {
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
	};

	const columns = useTaskColumns();

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<SharedPageHeader
				primaryIcon={pageIcon}
				primaryLabel={pageTitle}
				secondaryLabel={secondaryLabel}
				addIcon={showCreateButton ? Plus : undefined}
				addLabel={showCreateButton ? "Add task" : undefined}
				onAdd={
					showCreateButton ? () => listState.setModalOpen(true) : undefined
				}
				onPrimaryClick={handleReset}
				views={savedViews.views}
				activeViewId={savedViews.activeViewId}
				onViewSelect={listState.handleViewSelect}
				onViewDelete={savedViews.deleteView}
				onStartCreateView={listState.handleStartCreateView}
			/>

			{subHeader}

			<FilterBar />

			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 lg:px-6">
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

			<TaskModal
				open={listState.modalOpen}
				onOpenChange={listState.setModalOpen}
				mode="create"
			/>

			{props.renderBulkActions ? (
				props.renderBulkActions({
					selectedIds: listState.selectedIds,
					clearRowSelection: listState.clearRowSelection,
					setModalOpen: listState.setModalOpen,
					modalOpen: listState.modalOpen,
					hasSelection: listState.hasSelection,
					rowSelection: listState.rowSelection,
					setRowSelection: listState.setRowSelection,
				})
			) : (
				<BulkActionsBar
					selectedTaskIds={listState.selectedIds}
					totalTasks={pageTasks.length}
					onClearSelection={listState.clearRowSelection}
					onSelectAll={() => {
						const allSelected = pageTasks.reduce(
							(acc, task) => {
								acc[task.id] = true;
								return acc;
							},
							{} as Record<string, boolean>,
						);
						listState.setRowSelection(allSelected);
					}}
				/>
			)}
		</div>
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
