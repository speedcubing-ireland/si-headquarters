import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Box, Plus } from "lucide-react";
import { useEffect } from "react";
import { useQueryStates } from "nuqs";
import { columns } from "@/components/competitions/columns";
import { DataTable } from "@/components/competitions/data-table";
import { DisplaySettings } from "@/components/competitions/display-settings";
import { FilterChips } from "@/components/competitions/filter-chips";
import { FilterPopover } from "@/components/competitions/filter-popover";
import {
	CreateViewProvider,
	ListPageLayout,
} from "@/components/shared/list-page-layout";
import { SharedPageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useIsDetailRoute } from "@/hooks/use-is-detail-route";
import { useListPageState } from "@/hooks/use-list-page-state";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { useDisplaySettingsStore } from "@/store/display-settings-store";
import { useCompetitionsSavedViews } from "@/store/use-competitions-saved-views";
import {
	initializeCompetitionsStoreFromSearch,
	useSyncCompetitionsFiltersToUrl,
} from "@/lib/route-state";
import { competitionsFilterParsers } from "@/lib/nuqs-parsers";
import { useCreateModalsStore } from "@/store/create-modals-store";

export const Route = createFileRoute("/competitions/")({
	onLeave: () => {
		useCompetitionsFilterStore.getState().clearFilters();
		useDisplaySettingsStore.getState().fromJSON(
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
	onAddCompetition,
	views,
	activeViewId,
	onViewSelect,
	onViewDelete,
	onStartCreateView,
	onAllComps,
}: {
	onAddCompetition: () => void;
	views: ReturnType<typeof useCompetitionsSavedViews>["views"];
	activeViewId: string | null;
	onViewSelect: (viewId: string) => void;
	onViewDelete: (viewId: string) => void;
	onStartCreateView: () => void;
	onAllComps: () => void;
}) {
	return (
		<SharedPageHeader
			primaryIcon={Box}
			primaryLabel="All comps"
			addIcon={Plus}
			addLabel="Add competition"
			onAdd={onAddCompetition}
			onPrimaryClick={onAllComps}
			views={views}
			activeViewId={activeViewId}
			onViewSelect={onViewSelect}
			onViewDelete={onViewDelete}
			onStartCreateView={onStartCreateView}
		/>
	);
}

function FiltersContent() {
	const matchMode = useCompetitionsFilterStore((state) => state.matchMode);
	const toggleMatchMode = useCompetitionsFilterStore(
		(state) => state.toggleMatchMode,
	);
	const hasActiveFilters = useCompetitionsFilterStore(
		(state) => state.hasActiveFilters,
	);

	return (
		<>
			<div className="flex items-center gap-2 shrink-0">
				<FilterPopover />
			</div>
			<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
				<FilterChips />
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<DisplaySettings />
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
	const savedViews = useCompetitionsSavedViews();
	const listState = useListPageState({
		filterStore: useCompetitionsFilterStore,
		displayStore: useDisplaySettingsStore,
		savedViews,
	});

	const [search] = useQueryStates(competitionsFilterParsers);

	useEffect(() => {
		initializeCompetitionsStoreFromSearch(
			search as Parameters<typeof initializeCompetitionsStoreFromSearch>[0],
			useCompetitionsFilterStore,
			useDisplaySettingsStore,
			savedViews,
		);
	}, []);

	useSyncCompetitionsFiltersToUrl({
		filterStore: useCompetitionsFilterStore,
		displayStore: useDisplaySettingsStore,
		savedViews,
		activeViewId: savedViews.activeViewId,
	});

	const isDetailRoute = useIsDetailRoute("competitions");
	const { openCompetition } = useCreateModalsStore();

	if (isDetailRoute) {
		return <Outlet />;
	}

	return (
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
				header={
					<PageHeader
						onAddCompetition={openCompetition}
						views={savedViews.views}
						activeViewId={savedViews.activeViewId}
						onViewSelect={listState.handleViewSelect}
						onViewDelete={savedViews.deleteView}
						onStartCreateView={listState.handleStartCreateView}
						onAllComps={listState.handleResetAll}
					/>
				}
				filtersRow={<FiltersContent />}
				table={<DataTable columns={columns} />}
				modal={null}
			/>
		</CreateViewProvider>
	);
}
