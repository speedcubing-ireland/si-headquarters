"use client";

import * as React from "react";
import { Check } from "lucide-react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface CommandPickerOption {
	value: string;
	label: string;
	icon?: React.ComponentType<{ className?: string }>;
	color?: string;
	group?: string;
}

interface CommandPickerProps {
	value: string;
	options: CommandPickerOption[];
	onChange: (value: string) => void;
	trigger: React.ReactNode;
	emptyText?: string;
	searchPlaceholder?: string;
	className?: string;
	align?: "start" | "center" | "end";
}

export function CommandPicker({
	value,
	options,
	onChange,
	trigger,
	emptyText = "No options found.",
	searchPlaceholder = "Search...",
	className,
	align = "end",
}: CommandPickerProps) {
	const [open, setOpen] = React.useState(false);

	// Group options by their group property
	const groupedOptions = React.useMemo(() => {
		const groups: Record<string, CommandPickerOption[]> = {};
		const ungrouped: CommandPickerOption[] = [];

		for (const option of options) {
			if (option.group) {
				if (!groups[option.group]) {
					groups[option.group] = [];
				}
				groups[option.group].push(option);
			} else {
				ungrouped.push(option);
			}
		}

		return { groups, ungrouped };
	}, [options]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent className={cn("p-0 w-[240px]", className)} align={align}>
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList className="max-h-[300px]">
						<CommandEmpty>{emptyText}</CommandEmpty>

						{/* Ungrouped options */}
						{groupedOptions.ungrouped.length > 0 && (
							<CommandGroup>
								{groupedOptions.ungrouped.map((option) => (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={() => {
											onChange(option.value);
											setOpen(false);
										}}
									>
										<div className="flex items-center gap-2 flex-1">
											{option.icon && (
												<option.icon className={cn("size-4", option.color)} />
											)}
											<span className="text-sm">{option.label}</span>
										</div>
										{value === option.value && (
											<Check className="size-4 text-primary" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{/* Grouped options */}
						{Object.entries(groupedOptions.groups).map(([groupName, items]) => (
							<CommandGroup key={groupName} heading={groupName}>
								{items.map((option) => (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={() => {
											onChange(option.value);
											setOpen(false);
										}}
									>
										<div className="flex items-center gap-2 flex-1">
											{option.icon && (
												<option.icon className={cn("size-4", option.color)} />
											)}
											<span className="text-sm">{option.label}</span>
										</div>
										{value === option.value && (
											<Check className="size-4 text-primary" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
