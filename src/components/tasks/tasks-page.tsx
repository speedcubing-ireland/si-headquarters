import { useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryStates } from "nuqs";
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
import { FilterBar } from "./filter-bar";
import { BulkActionsBar } from "./bulk-actions-bar";
import type { ReactNode } from "react";
import type { TasksPageConfig } from "@/store/create-tasks-page-store";
import {
	CreateViewProvider,
	ListPageLayout,
} from "@/components/shared/list-page-layout";
import { useCreateModalsStore } from "@/store/create-modals-store";

export type TasksPageProps = {
	pageId: string;
	pageTitle: string;
	pageIcon: LucideIcon;

	taskSource?: "all" | "archived";

	pagePredicates?: TaskPredicate[];
	pagePredicateMode?: MatchMode;

	defaultFilters?: TasksPageConfig["defaultFilters"];
	defaultDisplaySettings?: TasksPageConfig["defaultDisplaySettings"];

	showCreateButton?: boolean;
	showClearButton?: boolean;

	subHeader?: ReactNode;

	bulkActions?: ReactNode;
};

function TasksPageInner(props: TasksPageProps) {
	const {
		pageTitle,
		pageIcon,
		taskSource = "all",
		pagePredicates = [],
		pagePredicateMode = "any",
		showCreateButton = true,
		subHeader,
	} = props;

	const { filterStore, displayStore, savedViews } = useTasksPageContext();

	const { tasks: allTasks } = useTasks(taskSource === "archived");

	const [search] = useQueryStates(tasksFilterParsers);

	const pageTasks = useMemo(() => {
		if (pagePredicates.length === 0) return allTasks;
		return bulkFilterItems(allTasks, pagePredicateMode, pagePredicates);
	}, [allTasks, pagePredicates, pagePredicateMode]);

	const listState = useListPageState({
		filterStore,
		displayStore,
		savedViews,
	});
	const { openTask } = useCreateModalsStore();

	useSyncTasksFiltersToUrl({
		filterStore,
		displayStore,
		savedViews,
		activeViewId: savedViews.activeViewId,
	});

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

	const handleReset = useCallback(() => {
		filterStore.getState().clearFilters();

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
					<Button variant="ghost" size="sm" onClick={openTask}>
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
			<TasksDataTable
				columns={columns}
				tasks={pageTasks}
				enableRowSelection={true}
				rowSelection={listState.rowSelection}
				onRowSelectionChange={listState.setRowSelection}
				autoHideRowSelection={true}
				skipClientFiltering={taskSource === "archived"}
			/>
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

	const modal = props.bulkActions ?? (
		<BulkActionsBar
			totalTasks={pageTasks.length}
			onSelectAll={handleSelectAll}
		/>
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
