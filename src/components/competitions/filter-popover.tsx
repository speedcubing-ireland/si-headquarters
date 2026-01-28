import { Calendar, User } from "lucide-react";
import { useState } from "react";
import { SharedFilterPopoverTrigger } from "@/components/shared/filters/filter-popover";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getActiveFiltersCount as getActiveFiltersCountFromFilters } from "@/lib/competitions-filters";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { FilterSubMenu } from "./filter-sub-menu";

export function FilterPopover() {
	const filters = useCompetitionsFilterStore((state) => state.filters);
	const toggleFilter = useCompetitionsFilterStore(
		(state) => state.toggleFilter,
	);
	const clearFilters = useCompetitionsFilterStore(
		(state) => state.clearFilters,
	);
	const setFilter = useCompetitionsFilterStore((state) => state.setFilter);
	const [open, setOpen] = useState(false);

	const handleToggleFilter = (
		type: "phase" | "compLead" | "leadDelegate" | "organisers",
		value: string,
	) => {
		toggleFilter(type, value);
		setOpen(false);
	};

	const getSelectedValues = (
		type: "phase" | "compLead" | "leadDelegate" | "organisers",
	): string[] => {
		return filters[type].flatMap((item) => item.values);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<SharedFilterPopoverTrigger
					count={getActiveFiltersCountFromFilters(filters)}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<DropdownMenuGroup>
					<FilterSubMenu
						type="phase"
						icon={Calendar}
						label="Phase"
						filterCount={filters.phase.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("phase")}
					/>
					<FilterSubMenu
						type="compLead"
						icon={User}
						label="Comp lead"
						filterCount={filters.compLead.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("compLead")}
					/>
					<FilterSubMenu
						type="leadDelegate"
						icon={User}
						label="Lead delegate"
						filterCount={filters.leadDelegate.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("leadDelegate")}
					/>
					<FilterSubMenu
						type="organisers"
						icon={User}
						label="Organiser"
						filterCount={filters.organisers.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("organisers")}
					/>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Calendar className="size-4" />
							Date
							{filters.dateRange &&
								(filters.dateRange.start || filters.dateRange.end) && (
									<span className="ml-auto text-xs text-muted-foreground">
										1
									</span>
								)}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-60">
							<Command>
								<CommandList>
									<CommandGroup>
										<CommandItem
											onSelect={() => {
												const today = new Date().toISOString().split("T")[0];
												setFilter("date", { start: today });
												setOpen(false);
											}}
											className="cursor-pointer"
										>
											Today
										</CommandItem>
										<CommandItem
											onSelect={() => {
												const tomorrow = new Date();
												tomorrow.setDate(tomorrow.getDate() + 1);
												setFilter("date", {
													start: tomorrow.toISOString().split("T")[0],
												});
												setOpen(false);
											}}
											className="cursor-pointer"
										>
											Tomorrow
										</CommandItem>
										<CommandItem
											onSelect={() => {
												const nextWeek = new Date();
												nextWeek.setDate(nextWeek.getDate() + 7);
												setFilter("date", {
													start: new Date().toISOString().split("T")[0],
													end: nextWeek.toISOString().split("T")[0],
												});
												setOpen(false);
											}}
											className="cursor-pointer"
										>
											Next 7 days
										</CommandItem>
									</CommandGroup>
								</CommandList>
							</Command>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
				{getActiveFiltersCountFromFilters(filters) > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => clearFilters()}>
							Clear all filters
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
