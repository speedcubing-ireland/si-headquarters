import { useState } from "react";
import { SharedFilterPopoverTrigger } from "@/components/shared/filters/filter-popover";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataV2 } from "@/data/data-store-v2";
import {
	getTaskFilterOptions,
	type TaskFilterType,
	taskFilterConfigs,
} from "@/lib/task-filter-config";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
import { TasksFilterSubMenu } from "./filter-sub-menu";

export function TasksFilterPopover() {
	const users = useDataV2((state) => state.users);
	const labels = useDataV2((state) => state.labels);
	const filters = useTasksFilterStore((state) => state.filters);
	const toggleFilter = useTasksFilterStore((state) => state.toggleFilter);
	const clearFilters = useTasksFilterStore((state) => state.clearFilters);
	const getActiveFiltersCount = useTasksFilterStore(
		(state) => state.getActiveFiltersCount,
	);
	const [open, setOpen] = useState(false);

	const filterTypes: TaskFilterType[] = [
		"status",
		"priority",
		"assignee",
		"labels",
	];

	const handleToggleFilter = (type: TaskFilterType, value: string) => {
		toggleFilter(type as "status" | "priority" | "assignee" | "labels", value);
		setOpen(false);
	};

	const getSelectedValues = (type: TaskFilterType): string[] => {
		const items = filters[type] as { values: string[] }[] | undefined;
		return items ? items.flatMap((i) => i.values) : [];
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<SharedFilterPopoverTrigger count={getActiveFiltersCount()} />
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<DropdownMenuGroup>
					{filterTypes.map((type) => {
						const config = taskFilterConfigs[type];
						const options = getTaskFilterOptions(type, users, labels);
						return (
							<TasksFilterSubMenu
								key={type}
								type={type}
								icon={config.icon}
								label={config.label}
								filterCount={(filters[type] as unknown as unknown[] | undefined)?.length ?? 0}
								placeholder={config.placeholder}
								emptyMessage={config.emptyMessage}
								options={options}
								selectedValues={getSelectedValues(type)}
								onToggleFilter={handleToggleFilter}
							/>
						);
					})}
				</DropdownMenuGroup>
				{getActiveFiltersCount() > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								clearFilters();
								setOpen(false);
							}}
						>
							Clear all filters
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
