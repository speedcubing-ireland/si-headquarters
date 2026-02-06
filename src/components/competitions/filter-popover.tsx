import { Calendar, User } from "lucide-react";
import { useState } from "react";
import { SharedFilterPopover } from "@/components/shared/filters/filter-popover";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";
import type { CompetitionsFilters } from "@/lib/filter-types";
import { FilterSubMenu } from "./filter-sub-menu";

export function FilterPopover() {
	const { filters, setArrayFilter, clearFilters, setDateRange } =
		useCompetitionsUrlContext();
	const [open, setOpen] = useState(false);

	type ArrayFilterKey = Exclude<keyof CompetitionsFilters, "dateRange">;

	const handleToggleFilter = (type: ArrayFilterKey, value: string) => {
		const currentValues = filters[type];
		const existingItem = currentValues?.find((item) =>
			item.values.includes(value),
		);

		if (existingItem) {
			const newValues = existingItem.values.filter((v) => v !== value);
			if (newValues.length === 0) {
				const newFilterValues = currentValues.filter(
					(item) => !item.values.includes(value),
				);
				setArrayFilter(type, newFilterValues);
			} else {
				const newFilterValues = currentValues.map((item) =>
					item.values.includes(value) ? { ...item, values: newValues } : item,
				);
				setArrayFilter(type, newFilterValues);
			}
		} else {
			const newFilterValues = [
				...currentValues,
				{ values: [value], isNot: false },
			];
			setArrayFilter(type, newFilterValues);
		}
		setOpen(false);
	};

	const getSelectedValues = (type: ArrayFilterKey): string[] => {
		return filters[type].flatMap((item) => item.values);
	};

	const count =
		filters.phase.length +
		filters.compLead.length +
		filters.leadDelegate.length +
		filters.organisers.length +
		(filters.dateRange ? 1 : 0);

	return (
		<SharedFilterPopover
			count={count}
			onClear={clearFilters}
			open={open}
			onOpenChange={setOpen}
		>
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
							<span className="ml-auto text-xs text-muted-foreground">1</span>
						)}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent className="w-60">
					<Command>
						<CommandList>
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										const today = new Date().toISOString().split("T")[0];
										setDateRange({ start: today, isNot: false });
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
										setDateRange({
											start: tomorrow.toISOString().split("T")[0],
											isNot: false,
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
										setDateRange({
											start: new Date().toISOString().split("T")[0],
											end: nextWeek.toISOString().split("T")[0],
											isNot: false,
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
		</SharedFilterPopover>
	);
}
