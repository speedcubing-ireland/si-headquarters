import { createFileRoute } from "@tanstack/react-router";
import { Box, LayersPlus, Plus } from "lucide-react";
import { columns } from "@/components/competitions/columns";
import { DataTable } from "@/components/competitions/data-table";
import { DisplaySettings } from "@/components/competitions/display-settings";
import { FilterChips } from "@/components/competitions/filter-chips";
import { FilterPopover } from "@/components/competitions/filter-popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import {
	hasActiveFilters as hasActiveFiltersFromFilters,
} from "@/lib/competitions-filters";

export const Route = createFileRoute("/competitions")({
	component: RouteComponent,
});

function PageHeader() {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<Button variant="secondary" size="sm">
					<Box className="size-4" />
					All comps
				</Button>
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				<Button variant="ghost" size="sm">
					<LayersPlus className="size-4" />
					New view
				</Button>
				<div className="ml-auto flex items-center gap-2">
					<Button variant="ghost" size="sm">
						<Plus className="size-4" />
						Add competition
					</Button>
					<SidebarTrigger />
				</div>
			</div>
		</header>
	);
}

function Filters() {
	const { matchMode, toggleMatchMode } = useCompetitionsFilterStore();
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
	return (
		<>
			<PageHeader />
			<Filters />
			<DataTable columns={columns} />
		</>
	);
}
