import {
	createFileRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { Box, Plus } from "lucide-react";
import { useState } from "react";
import { columns } from "@/components/competitions/columns";
import { CompetitionModal } from "@/components/competitions/competition-modal";
import { DataTable } from "@/components/competitions/data-table";
import { DisplaySettings } from "@/components/competitions/display-settings";
import { FilterChips } from "@/components/competitions/filter-chips";
import { FilterPopover } from "@/components/competitions/filter-popover";
import { SharedPageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasActiveFilters as hasActiveFiltersFromFilters } from "@/lib/competitions-filters";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { useDisplaySettingsStore } from "@/store/display-settings-store";
import { useCompetitionsSavedViews } from "@/store/use-competitions-saved-views";

export const Route = createFileRoute("/competitions")({
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

function Filters() {
	const matchMode = useCompetitionsFilterStore((state) => state.matchMode);
	const toggleMatchMode = useCompetitionsFilterStore(
		(state) => state.toggleMatchMode,
	);
	const filters = useCompetitionsFilterStore((state) => state.filters);

	return (
		<div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
			<div className="flex w-full items-center gap-2 px-4 lg:px-6">
				<div className="flex items-center gap-2 shrink-0">
					<FilterPopover />
				</div>
				<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
					<FilterChips />
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<DisplaySettings />
					{hasActiveFiltersFromFilters(filters) && (
						<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
							{matchMode === "any" ? "Match any filter" : "Match all filters"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

function RouteComponent() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCreatingView, setIsCreatingView] = useState(false);
	const [viewName, setViewName] = useState("");
	const [viewDescription, setViewDescription] = useState("");
	const [previousFiltersJson, setPreviousFiltersJson] = useState<string | null>(
		null,
	);
	const [previousDisplayJson, setPreviousDisplayJson] = useState<string | null>(
		null,
	);

	const savedViews = useCompetitionsSavedViews();
	const filterStore = useCompetitionsFilterStore;
	const displayStore = useDisplaySettingsStore;
	const matchMode = useCompetitionsFilterStore((state) => state.matchMode);
	const toggleMatchMode = useCompetitionsFilterStore(
		(state) => state.toggleMatchMode,
	);
	const filters = useCompetitionsFilterStore((state) => state.filters);

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const segments = pathname.split("/").filter(Boolean);
	const isDetailRoute = segments.length > 1 && segments[0] === "competitions";

	const handleStartCreateView = () => {
		setPreviousFiltersJson(filterStore.getState().toJSON());
		setPreviousDisplayJson(displayStore.getState().toJSON());
		setViewName("");
		setViewDescription("");
		setIsCreatingView(true);
	};

	const handleCancelCreateView = () => {
		if (previousFiltersJson) {
			filterStore.getState().fromJSON(previousFiltersJson);
		}
		if (previousDisplayJson) {
			displayStore.getState().fromJSON(previousDisplayJson);
		}
		setIsCreatingView(false);
		setViewName("");
		setViewDescription("");
		setPreviousFiltersJson(null);
		setPreviousDisplayJson(null);
	};

	const handleSaveView = () => {
		if (!viewName.trim()) return;

		savedViews.createCurrentView(viewName, viewDescription || undefined);
		setIsCreatingView(false);
		setViewName("");
		setViewDescription("");
		setPreviousFiltersJson(null);
		setPreviousDisplayJson(null);
	};

	const handleViewSelect = (viewId: string) => {
		savedViews.applyView(viewId);
	};

	const handleAllComps = () => {
		// Reset filters + display settings, and clear active view.
		filterStore.getState().clearFilters();
		displayStore.getState().fromJSON(
			JSON.stringify({
				grouping: null,
				subGrouping: null,
				ordering: { field: null, direction: "asc" },
			}),
		);
		savedViews.setActiveView(null);
	};

	if (isDetailRoute) {
		return <Outlet />;
	}

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<PageHeader
				onAddCompetition={() => setIsModalOpen(true)}
				views={savedViews.views}
				activeViewId={savedViews.activeViewId}
				onViewSelect={handleViewSelect}
				onViewDelete={savedViews.deleteView}
				onStartCreateView={handleStartCreateView}
				onAllComps={handleAllComps}
			/>
			{isCreatingView ? (
				<div className="flex min-h-12 shrink-0 flex-col gap-3 border-b bg-background py-3 px-4 lg:px-6">
					{/* Top row: Name, Description, Actions */}
					<div className="flex items-start gap-4">
						<div className="flex flex-1 flex-col gap-2">
							<Input
								placeholder="View name"
								value={viewName}
								onChange={(e) => setViewName(e.target.value)}
								className="h-8 text-sm font-medium"
							/>
							<Textarea
								placeholder="Description (optional)"
								value={viewDescription}
								onChange={(e) => setViewDescription(e.target.value)}
								className="min-h-[60px] resize-none text-sm"
							/>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleCancelCreateView}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleSaveView}
								disabled={!viewName.trim()}
							>
								Save view
							</Button>
						</div>
					</div>

					{/* Bottom row: Filters, Match mode, Display */}
					<div className="flex w-full items-center gap-2">
						<div className="flex items-center gap-2 shrink-0">
							<FilterPopover />
						</div>
						<div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
							<FilterChips />
						</div>
						<div className="flex items-center gap-2 shrink-0">
							{hasActiveFiltersFromFilters(filters) && (
								<Button variant="ghost" size="sm" onClick={toggleMatchMode}>
									{matchMode === "any"
										? "Match any filter"
										: "Match all filters"}
								</Button>
							)}
							<DisplaySettings />
						</div>
					</div>
				</div>
			) : (
				<Filters />
			)}
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
				<DataTable columns={columns} />
			</div>
			<CompetitionModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				mode="create"
			/>
		</div>
	);
}
