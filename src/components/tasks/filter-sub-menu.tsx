import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskFilterOption, TaskFilterType } from "@/lib/task-filter-config";
import { cn } from "@/lib/utils";

type TasksFilterSubMenuProps = {
	type: TaskFilterType;
	icon: LucideIcon;
	label: string;
	filterCount: number;
	placeholder: string;
	emptyMessage: string;
	options: TaskFilterOption[];
	selectedValues: string[];
	onToggleFilter: (type: TaskFilterType, value: string) => void;
};

export function TasksFilterSubMenu({
	type,
	icon: Icon,
	label,
	filterCount,
	placeholder,
	emptyMessage,
	options,
	selectedValues,
	onToggleFilter,
}: TasksFilterSubMenuProps) {
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
								const selected = selectedValues.includes(value);
								const OptIcon = option.icon;
								return (
									<CommandItem
										key={`${type}-${value}`}
										value={option.label}
										onSelect={() => onToggleFilter(type, value)}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-2">
											{OptIcon ? (
												<OptIcon className="size-4 text-muted-foreground" />
											) : option.color ? (
												<div
													className="size-3 rounded-full"
													style={{ backgroundColor: option.color }}
												/>
											) : null}
											<span className="text-xs">{option.label}</span>
										</div>
										<CheckIcon
											className={cn(
												"size-4 text-muted-foreground",
												!selected && "opacity-0",
											)}
										/>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

