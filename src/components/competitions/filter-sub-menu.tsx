import type { LucideIcon } from "lucide-react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterOptionRow } from "@/components/competitions/filter-option-row";
import { useData } from "@/data/data-store";
import {
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";

interface FilterSubMenuProps {
	type: FilterType;
	icon: LucideIcon;
	label: string;
	filterCount: number;
	onToggleFilter: (type: FilterType, value: string) => void;
	selectedValues: string[];
}

export function FilterSubMenu({
	type,
	icon: Icon,
	label,
	filterCount,
	onToggleFilter,
	selectedValues,
}: FilterSubMenuProps) {
	const config = filterConfigs[type];
	const users = useData((state) => state.users);
	const options = getFilterOptions(type, users);

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<Icon className="size-4" />
				{label}
				{filterCount > 0 && (
					<span className="ml-auto text-xs text-muted-foreground">
						{filterCount}
					</span>
				)}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-60">
				<Command>
					<CommandInput placeholder={config.placeholder} />
					<CommandList>
						<CommandEmpty>{config.emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const optionValue = String(option.value);
								const isSelected = selectedValues.includes(optionValue);
								return (
									<FilterOptionRow
										key={optionValue}
										type={type}
										option={option}
										isSelected={isSelected}
										onSelect={() => onToggleFilter(type, optionValue)}
									/>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
