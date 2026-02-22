import { useMemo, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useTasks } from "@/hooks/use-convex-data";
import { TasksListStateContext } from "@/store/tasks-list-context";
import { useTasksSavedViews } from "@/lib/use-tasks-saved-views";
import { useListPageState } from "@/hooks/use-list-page-state";
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
import {
	CreateViewProvider,
	ListPageLayout,
} from "@/components/shared/list-page-layout";
import { useCreateModalsStore } from "@/store/create-modals-store";
import type { TasksFilters } from "@/lib/filter-types";
import { emptyTasksFilters } from "@/lib/filter-types";
import {
	parseDisplaySettingsJson,
	parseFiltersJson,
	serializeDisplaySettings,
	serializeFilters,
	type DisplaySettings,
} from "@/lib/saved-view-utils";
import { TasksUrlProvider, useTasksUrlContext } from "@/lib/tasks-url-context";

export type TasksPageProps = {
	pageId: string;
	pageTitle: string;
	pageIcon: LucideIcon;

	taskSource?: "all" | "archived";

	pagePredicates?: TaskPredicate[];
	pagePredicateMode?: MatchMode;

	defaultFilters?: Partial<TasksFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;

	showCreateButton?: boolean;
	showClearButton?: boolean;

	subHeader?: ReactNode;

	bulkActions?: ReactNode;
};

function TasksPageInner(props: TasksPageProps) {
	const {
		pageId,
		pageTitle,
		pageIcon,
		taskSource = "all",
		pagePredicates = [],
		pagePredicateMode = "any",
		showCreateButton = true,
		subHeader,
	} = props;

	const urlState = useTasksUrlContext();
	const savedViews = useTasksSavedViews({ entity: "tasks", pageId });

	const { tasks: allTasks, isLoading: tasksLoading } = useTasks(
		taskSource === "archived",
	);

	const pageTasks = useMemo(() => {
		if (pagePredicates.length === 0) return allTasks;
		return bulkFilterItems(allTasks, pagePredicateMode, pagePredicates);
	}, [allTasks, pagePredicates, pagePredicateMode]);

	const listState = useListPageState({
		savedViews,
		getFiltersJson: () =>
			serializeFilters(urlState.filters, urlState.matchMode),
		getDisplaySettingsJson: () =>
			serializeDisplaySettings(urlState.displaySettings),
		restoreFiltersJson: (json) => {
			const parsed = parseFiltersJson(json, emptyTasksFilters);
			urlState.setFiltersAndMatch(parsed.filters, parsed.matchMode);
		},
		restoreDisplaySettingsJson: (json) => {
			const parsed = parseDisplaySettingsJson(json);
			urlState.setDisplaySettings(parsed);
		},
		resetAll: urlState.clearAll,
	});
	const { openTask } = useCreateModalsStore();

	const columns = useTaskColumns();

	const header = (
		<PageHeader.Root>
			<PageHeader.Primary
				icon={pageIcon}
				label={pageTitle}
				onClick={listState.handleResetAll}
			/>

			<Separator
				orientation="vertical"
				className="mx-2 hidden data-[orientation=vertical]:h-4 sm:block"
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
						<span className="hidden sm:inline">Add task</span>
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
				filters={urlState.filters}
				matchMode={urlState.matchMode}
				grouping={urlState.displaySettings.grouping}
				subGrouping={urlState.displaySettings.subGrouping}
				ordering={urlState.displaySettings.ordering}
				onOrderingChange={urlState.setOrdering}
				isLoading={tasksLoading}
				enableRowSelection={true}
				rowSelection={listState.rowSelection}
				onRowSelectionChange={listState.setRowSelection}
				autoHideRowSelection={true}
				skipClientFiltering={taskSource === "archived"}
			/>
		</>
	);

	const handleSelectAll = useCallback(() => {
		const allSelected = pageTasks.reduce<Record<string, boolean>>(
			(acc, task) => {
				acc[task.id] = true;
				return acc;
			},
			{},
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
	return (
		<TasksUrlProvider
			pageId={props.pageId}
			defaultFilters={props.defaultFilters}
			defaultDisplaySettings={props.defaultDisplaySettings}
		>
			<TasksPageInner {...props} />
		</TasksUrlProvider>
	);
}
