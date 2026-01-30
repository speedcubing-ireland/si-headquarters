import type * as React from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SharedFilterOption } from "./filter-option-row";
import { SharedFilterOptionRow } from "./filter-option-row";

type SharedFilterValueSelectorProps = {
	placeholder: string;
	emptyMessage: string;
	options: SharedFilterOption[];
	selectedValues: string[];
	onToggleValue: (value: string) => void;
	children: React.ReactNode;
};

export function SharedFilterValueSelector({
	placeholder,
	emptyMessage,
	options,
	selectedValues,
	onToggleValue,
	children,
}: SharedFilterValueSelectorProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60 p-0" align="start">
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
										onSelect={() => onToggleValue(value)}
									/>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
