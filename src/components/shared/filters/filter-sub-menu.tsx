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
import type { SharedFilterOption } from "./filter-option-row";
import { SharedFilterOptionRow } from "./filter-option-row";

type SharedFilterSubMenuProps = {
	icon: LucideIcon;
	label: string;
	filterCount: number;
	placeholder: string;
	emptyMessage: string;
	options: SharedFilterOption[];
	selectedValues: string[];
	onToggleFilter: (value: string) => void;
};

export function SharedFilterSubMenu({
	icon: Icon,
	label,
	filterCount,
	placeholder,
	emptyMessage,
	options,
	selectedValues,
	onToggleFilter,
}: SharedFilterSubMenuProps) {
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
			<DropdownMenuSubContent className="w-60 p-0">
				<Command>
					<CommandInput placeholder={placeholder} />
					<CommandList>
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const value = String(option.value);
								const isSelected = selectedValues.includes(value);
								return (
									<SharedFilterOptionRow
										key={value}
										option={option}
										isSelected={isSelected}
										onSelect={() => onToggleFilter(value)}
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
