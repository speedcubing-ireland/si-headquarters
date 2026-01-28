import {
	Calendar,
	CircleCheck,
	ListFilter,
	SignalHigh,
	User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import {
	getActiveFiltersCount as getActiveFiltersCountFromFilters,
} from "@/lib/competitions-filters";
import { FilterSubMenu } from "./filter-sub-menu";

export function FilterPopover() {
	const filters = useCompetitionsFilterStore((state) => state.filters);
	const toggleFilter = useCompetitionsFilterStore((state) => state.toggleFilter);
	const clearFilters = useCompetitionsFilterStore((state) => state.clearFilters);
	const setFilter = useCompetitionsFilterStore((state) => state.setFilter);
	const [open, setOpen] = useState(false);

	const handleToggleFilter = (
		type: "status" | "priority" | "leads",
		value: string,
	) => {
		toggleFilter(type, value);
		setOpen(false);
	};

	const getSelectedValues = (
		type: "status" | "priority" | "leads",
	): string[] => {
		return filters[type].flatMap((item) => item.values);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button size="sm" variant="ghost">
					<ListFilter className="size-4" />
					{getActiveFiltersCountFromFilters(filters) === 0 && (
						<span className="ml-1">Filter</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<DropdownMenuGroup>
					<FilterSubMenu
						type="status"
						icon={CircleCheck}
						label="Status"
						filterCount={filters.status.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("status")}
					/>
					<FilterSubMenu
						type="priority"
						icon={SignalHigh}
						label="Priority"
						filterCount={filters.priority.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("priority")}
					/>
					<FilterSubMenu
						type="leads"
						icon={User}
						label="Lead"
						filterCount={filters.leads.length}
						onToggleFilter={handleToggleFilter}
						selectedValues={getSelectedValues("leads")}
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
