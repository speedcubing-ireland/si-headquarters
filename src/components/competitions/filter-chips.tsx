import { CheckIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useData } from "@/data/data-store";
import type { Priority, Status, User } from "@/data/types";
import {
	getInitials,
	getPriorityIcon,
	priorityLabels,
} from "@/lib/competitions-utils";
import { type FilterType, filterConfigs } from "@/lib/filter-config";
import {
	hasActiveFilters as hasActiveFiltersFromFilters,
} from "@/lib/competitions-filters";
import { getStatusClass, getStatusLabel } from "@/lib/status-config";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { DateFilterChip } from "./date-filter-chip";
import { FilterValueSelector } from "./filter-value-selector";

function FilterChip<T extends Status | Priority | string>({
	icon: Icon,
	label,
	type,
	values,
	isNot,
	onToggleIsNot,
	onToggleValue,
	onRemove,
	renderValue,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	type: FilterType;
	values: T[];
	isNot: boolean;
	onToggleIsNot: () => void;
	onToggleValue: (value: T) => void;
	onRemove: () => void;
	renderValue: (value: T) => ReactNode;
}) {
	const hasMultiple = values.length > 1;
	const isNotText = hasMultiple
		? isNot
			? "is none"
			: "is any"
		: isNot
			? "is not"
			: "is";

	return (
		<ButtonGroup>
			<Button variant="outline" size="xs">
				<Icon className="size-4" />
				{label}
			</Button>
			<ButtonGroupSeparator orientation="vertical" />
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="xs">
						{isNotText}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem
						onSelect={() => {
							if (isNot) {
								onToggleIsNot();
							}
						}}
					>
						{hasMultiple ? "is any" : "is"}
						{!isNot && <CheckIcon className="ml-auto size-4" />}
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => {
							if (!isNot) {
								onToggleIsNot();
							}
						}}
					>
						{hasMultiple ? "is none" : "is not"}
						{isNot && <CheckIcon className="ml-auto size-4" />}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ButtonGroupSeparator orientation="vertical" />
			<FilterValueSelector
				type={type}
				selectedValues={values}
				onToggleValue={onToggleValue}
			>
				<Button variant="outline" size="xs" className="min-w-0">
					{values.length === 1 ? (
						renderValue(values[0])
					) : (
						<span className="truncate">
							{values.length} {label.toLowerCase()}
						</span>
					)}
				</Button>
			</FilterValueSelector>
			<ButtonGroupSeparator orientation="vertical" />
			<Button variant="outline" size="icon-xs" onClick={onRemove}>
				<X />
			</Button>
		</ButtonGroup>
	);
}

const filterTypeConfigs: Record<
	FilterType,
	{
		renderValue: (
			value: Status | Priority | string,
			users?: User[],
		) => ReactNode;
		getIcon: (
			value?: Status | Priority | string,
		) => React.ComponentType<{ className?: string }>;
	}
> = {
	status: {
		renderValue: (value) => (
			<Badge className={getStatusClass(value as Status)}>
				{getStatusLabel(value as Status)}
			</Badge>
		),
		getIcon: () => filterConfigs.status.icon,
	},
	priority: {
		renderValue: (value) => {
			const Icon = getPriorityIcon(value as Priority);
			return (
				<>
					<Icon className="size-4" />
					{priorityLabels[value as Priority]}
				</>
			);
		},
		getIcon: (value) => getPriorityIcon((value || "low") as Priority),
	},
	leads: {
		renderValue: (value, users) => {
			const user = users?.find((u) => u.name === value);
			return (
				<>
					<Avatar className="size-4">
						<AvatarImage src={user?.avatarUrl} alt={String(value)} />
						<AvatarFallback className="text-[10px]">
							{getInitials(String(value))}
						</AvatarFallback>
					</Avatar>
					{value}
				</>
			);
		},
		getIcon: () => filterConfigs.leads.icon,
	},
};

export function FilterChips() {
	const filters = useCompetitionsFilterStore((state) => state.filters);
	const toggleFilterValue = useCompetitionsFilterStore(
		(state) => state.toggleFilterValue,
	);
	const toggleFilterIsNot = useCompetitionsFilterStore(
		(state) => state.toggleFilterIsNot,
	);
	const clearFilterType = useCompetitionsFilterStore(
		(state) => state.clearFilterType,
	);
	const toggleFilter = useCompetitionsFilterStore((state) => state.toggleFilter);
	const users = useData((state) => state.users);

	const hasActiveFilters = hasActiveFiltersFromFilters(filters);

	if (!hasActiveFilters) {
		return null;
	}

	// Data-driven filter chip rendering
	const filterTypes: FilterType[] = ["status", "priority", "leads"];

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{filterTypes.map((type) => {
				const config = filterConfigs[type];
				const filterItems = filters[type];
				const typeConfig = filterTypeConfigs[type];

				return filterItems.map((item, index) => {
					const Icon = typeConfig.getIcon(item.values[0]);
					return (
						<FilterChip
							key={`${type}-${index}-${item.values.join(",")}`}
							icon={Icon}
							label={config.label}
							type={type}
							values={item.values}
							isNot={item.isNot}
							onToggleIsNot={() => toggleFilterIsNot(type, index)}
							onToggleValue={(value) => toggleFilterValue(type, index, value)}
							onRemove={() => {
								item.values.forEach((value) => {
									toggleFilter(type, value);
								});
							}}
							renderValue={(value) => typeConfig.renderValue(value, users)}
						/>
					);
				});
			})}
			{filters.dateRange &&
				(filters.dateRange.start || filters.dateRange.end) && (
					<DateFilterChip
						dateRange={filters.dateRange}
						onClear={() => clearFilterType("date")}
					/>
				)}
		</div>
	);
}
