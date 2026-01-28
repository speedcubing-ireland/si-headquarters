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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataV2 } from "@/data/data-store-v2";
import {
	getTaskFilterOptions,
	type TaskFilterType,
	taskFilterConfigs,
} from "@/lib/task-filter-config";
import { cn } from "@/lib/utils";

type TasksFilterValueSelectorProps<TValue extends string> = {
	type: TaskFilterType;
	selectedValues: TValue[];
	onToggleValue: (value: TValue) => void;
	children: React.ReactNode;
};

export function TasksFilterValueSelector<TValue extends string>({
	type,
	selectedValues,
	onToggleValue,
	children,
}: TasksFilterValueSelectorProps<TValue>) {
	const users = useDataV2((state) => state.users);
	const labels = useDataV2((state) => state.labels);

	const config = taskFilterConfigs[type];
	const options = getTaskFilterOptions(type, users, labels);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60 p-0" align="start">
				<Command>
					<CommandInput placeholder={config.placeholder} />
					<CommandList>
						<CommandEmpty>{config.emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const value = String(option.value) as TValue;
								const selected = selectedValues.includes(value);
								const OptIcon = option.icon;
								return (
									<CommandItem
										key={`${type}-${value}`}
										value={option.label}
										onSelect={() => onToggleValue(value)}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-2">
											{option.avatarUrl ? (
												<img
													alt=""
													src={option.avatarUrl}
													className="size-4 rounded-full"
												/>
											) : OptIcon ? (
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

