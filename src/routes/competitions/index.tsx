import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Box, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
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
import { useCompetitionsSavedViews } from "@/store/use-competitions-saved-views";
import {
	CompetitionsUrlProvider,
	useCompetitionsUrlContext,
} from "@/lib/competitions-url-context";
import { useCreateModalsStore } from "@/store/create-modals-store";
import {
	parseDisplaySettingsJson,
	parseFiltersJson,
	serializeDisplaySettings,
	serializeFilters,
} from "@/lib/saved-view-utils";
import { emptyCompetitionsFilters } from "@/lib/filter-types";

export const Route = createFileRoute("/competitions/")({
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
	onAddCompetition?: () => void;
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
			addIcon={onAddCompetition ? Plus : undefined}
			addLabel={onAddCompetition ? "Add competition" : undefined}
			onAdd={onAddCompetition}
			onPrimaryClick={onAllComps}
			views={views}
			activeViewId={activeViewId}
			onViewSelect={onViewSelect}
			onViewDelete={onViewDelete}
			onStartCreateView={onStartCreateView}
			extraActions={undefined}
		/>
	);
}

function FiltersContent() {
	const { matchMode, setMatchMode, filters } = useCompetitionsUrlContext();

	const hasActiveFilters =
		filters.phase.length > 0 ||
		filters.compLead.length > 0 ||
		filters.leadDelegate.length > 0 ||
		filters.organisers.length > 0 ||
		filters.dateRange !== undefined;

	const toggleMatchMode = () => {
		setMatchMode(matchMode === "any" ? "all" : "any");
	};

	return (
		<>
			<div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
				<FilterPopover />
			</div>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
				<FilterChips />
			</div>
			<div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start sm:shrink-0">
				<DisplaySettings />
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
						<span className="sm:hidden">
							{matchMode === "any" ? "Any filter" : "All filters"}
						</span>
						<span className="hidden sm:inline">
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</span>
					</Button>
				)}
			</div>
		</>
	);
}

function RouteComponentInner() {
	const savedViews = useCompetitionsSavedViews();
	const isVolunteer = useQuery(api.auth.isVolunteerQuery);
	const urlState = useCompetitionsUrlContext();
	const listState = useListPageState({
		savedViews,
		getFiltersJson: () =>
			serializeFilters(urlState.filters, urlState.matchMode),
		getDisplaySettingsJson: () =>
			serializeDisplaySettings(urlState.displaySettings),
		restoreFiltersJson: (json) => {
			const parsed = parseFiltersJson(json, emptyCompetitionsFilters);
			urlState.setFiltersAndMatch(parsed.filters, parsed.matchMode);
		},
		restoreDisplaySettingsJson: (json) => {
			const parsed = parseDisplaySettingsJson(json);
			urlState.setDisplaySettings(parsed);
		},
		resetAll: urlState.clearAll,
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
						onAddCompetition={
							isVolunteer === true ? openCompetition : undefined
						}
						views={savedViews.views}
						activeViewId={savedViews.activeViewId}
						onViewSelect={listState.handleViewSelect}
						onViewDelete={savedViews.deleteView}
						onStartCreateView={listState.handleStartCreateView}
						onAllComps={urlState.clearAll}
					/>
				}
				filtersRow={<FiltersContent />}
				table={<DataTable columns={columns} />}
				modal={null}
			/>
		</CreateViewProvider>
	);
}

function RouteComponent() {
	return (
		<CompetitionsUrlProvider>
			<RouteComponentInner />
		</CompetitionsUrlProvider>
	);
}
