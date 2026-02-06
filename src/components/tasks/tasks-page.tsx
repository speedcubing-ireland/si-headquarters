import { useMemo, useCallback, useEffect, useRef } from "react";
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
import { hasActiveFilters } from "@/lib/task-filters";
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

	const { tasks: allTasks } = useTasks(taskSource === "archived");

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
			urlState.setArrayFilter("status", parsed.filters.status);
			urlState.setArrayFilter("priority", parsed.filters.priority);
			urlState.setArrayFilter("assignee", parsed.filters.assignee);
			urlState.setArrayFilter("labels", parsed.filters.labels);
			urlState.setArrayFilter("owner", parsed.filters.owner);
			urlState.setArrayFilter("parentType", parsed.filters.parentType);
			urlState.setDateRange(parsed.filters.dateRange);
			urlState.setMatchMode(parsed.matchMode);
		},
		restoreDisplaySettingsJson: (json) => {
			const parsed = parseDisplaySettingsJson(json);
			urlState.setGrouping(parsed.grouping);
			urlState.setSubGrouping(parsed.subGrouping);
			urlState.setOrdering(parsed.ordering.field, parsed.ordering.direction);
		},
		resetAll: urlState.clearAll,
	});
	const { openTask } = useCreateModalsStore();

	const handleReset = useCallback(() => {
		urlState.clearAll();
		savedViews.setActiveView(null);
	}, [urlState, savedViews]);

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
				filters={urlState.filters}
				matchMode={urlState.matchMode}
				grouping={urlState.displaySettings.grouping}
				subGrouping={urlState.displaySettings.subGrouping}
				ordering={urlState.displaySettings.ordering}
				onOrderingChange={urlState.setOrdering}
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

function TasksPageWithDefaults(props: TasksPageProps) {
	const {
		filters,
		displaySettings,
		isViewActive,
		setArrayFilter,
		setDateRange,
		setGrouping,
		setSubGrouping,
		setOrdering,
	} = useTasksUrlContext();
	const appliedDefaults = useRef(false);
	const { defaultFilters, defaultDisplaySettings } = props;

	useEffect(() => {
		if (appliedDefaults.current) return;
		if (!defaultFilters && !defaultDisplaySettings) return;
		if (isViewActive) return;

		const filtersEmpty = !hasActiveFilters(filters);
		const displayIsDefault =
			displaySettings.grouping === null &&
			displaySettings.subGrouping === null &&
			displaySettings.ordering.field === null &&
			displaySettings.ordering.direction === "asc";

		if (defaultFilters && filtersEmpty) {
			const mergedFilters = { ...emptyTasksFilters, ...defaultFilters };
			setArrayFilter("status", mergedFilters.status);
			setArrayFilter("priority", mergedFilters.priority);
			setArrayFilter("assignee", mergedFilters.assignee);
			setArrayFilter("labels", mergedFilters.labels);
			setArrayFilter("owner", mergedFilters.owner);
			setArrayFilter("parentType", mergedFilters.parentType);
			setDateRange(mergedFilters.dateRange);
		}

		if (defaultDisplaySettings && displayIsDefault) {
			const nextDisplay: DisplaySettings = {
				grouping: defaultDisplaySettings.grouping ?? null,
				subGrouping: defaultDisplaySettings.subGrouping ?? null,
				ordering: defaultDisplaySettings.ordering ?? {
					field: null,
					direction: "asc",
				},
			};
			setGrouping(nextDisplay.grouping);
			setSubGrouping(nextDisplay.subGrouping);
			setOrdering(nextDisplay.ordering.field, nextDisplay.ordering.direction);
		}

		appliedDefaults.current = true;
	}, [
		defaultFilters,
		defaultDisplaySettings,
		isViewActive,
		filters,
		displaySettings,
		setArrayFilter,
		setDateRange,
		setGrouping,
		setSubGrouping,
		setOrdering,
	]);
	return <TasksPageInner {...props} />;
}

export function TasksPage(props: TasksPageProps) {
	return (
		<TasksUrlProvider>
			<TasksPageWithDefaults {...props} />
		</TasksUrlProvider>
	);
}
