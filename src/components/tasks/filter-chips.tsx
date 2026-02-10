import { SharedDateRangeFilterChip } from "@/components/shared/filters/date-range-filter-chip";
import { SharedFilterChip } from "@/components/shared/filters/filter-chip";
import { Badge } from "@/components/ui/badge";
import type { TaskLabel, TaskPriority, TaskStatus } from "@/data/types-new";
import { useTaskFilterContext } from "@/hooks/use-task-filter-context";
import {
	priorityLabels,
	statusColors,
	statusLabels,
} from "@/lib/task-constants";
import { getFilterConfig } from "@/lib/task-filter-definitions";
import { renderUserValueByIdForFilter } from "@/lib/user-render-utils";
import { useTasksUrlContext } from "@/lib/tasks-url-context";
import type { TasksFilters } from "@/lib/filter-types";
import {
	handleToggleFilter,
	handleToggleFilterValue,
	handleToggleFilterIsNot,
	handleClearFilterType,
} from "@/lib/filter-handlers";
import { TasksFilterValueSelector } from "./filter-value-selector";

type ArrayFilterKey = Exclude<keyof TasksFilters, "dateRange">;

type FilterChipConfig = {
	key: ArrayFilterKey;
	label: string;
	renderValue: (value: string) => React.ReactNode;
};

function getStatusBadge(status: string) {
	const s = status as TaskStatus;
	const className = statusColors[s];
	return <Badge className={className}>{statusLabels[s]}</Badge>;
}

function getPriorityLabel(priority: string) {
	const p = priority as TaskPriority;
	return priorityLabels[p];
}

function renderLabel(value: string, labels: TaskLabel[]) {
	const label = labels.find((l) => l.id === value);
	if (!label) {
		return <span className="text-xs text-muted-foreground">Unknown</span>;
	}

	return (
		<span className="flex items-center gap-1 text-xs">
			<span
				className="size-3 rounded-full"
				style={{ backgroundColor: label.color }}
			/>
			{label.name}
		</span>
	);
}

export function TasksFilterChips() {
	const { filters, setArrayFilter, setDateRange } = useTasksUrlContext();
	const filterContext = useTaskFilterContext();

	const hasActiveFilters =
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.assignee.length > 0 ||
		filters.labels.length > 0 ||
		filters.owner.length > 0 ||
		filters.parentType.length > 0 ||
		filters.dateRange !== undefined;

	if (!hasActiveFilters) return null;

	const chipConfigs: FilterChipConfig[] = [
		{ key: "status", label: "Status", renderValue: getStatusBadge },
		{
			key: "priority",
			label: "Priority",
			renderValue: (value) => (
				<span className="text-xs font-medium">{getPriorityLabel(value)}</span>
			),
		},
		{
			key: "assignee",
			label: "Assignee",
			renderValue: (value) =>
				renderUserValueByIdForFilter(value, filterContext.users),
		},
		{
			key: "labels",
			label: "Labels",
			renderValue: (value) => renderLabel(value, filterContext.labels),
		},
		{
			key: "owner",
			label: "Owner",
			renderValue: (value) =>
				renderUserValueByIdForFilter(value, filterContext.users),
		},
		{
			key: "parentType",
			label: "Parent",
			renderValue: (value) => (
				<span className="text-xs font-medium capitalize">{value}</span>
			),
		},
	];

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{chipConfigs.map(({ key, label, renderValue }) => {
				const filterItems = filters[key];
				const config = getFilterConfig(key);
				const Icon = config?.displayIcon ?? (() => null);

				return filterItems.map((item, index) => (
					<SharedFilterChip
						key={`${key}-${index}-${item.values.join(",")}`}
						icon={Icon}
						label={label}
						values={item.values}
						isNot={item.isNot}
						onToggleIsNot={() =>
							handleToggleFilterIsNot(filters, setArrayFilter, key, index)
						}
						onToggleValue={(value) =>
							handleToggleFilterValue(
								filters,
								setArrayFilter,
								key,
								index,
								value,
							)
						}
						onRemove={() => {
							item.values.forEach((value) => {
								handleToggleFilter(filters, setArrayFilter, key, value);
							});
						}}
						renderValue={renderValue}
						wrapValueButton={(button) => (
							<TasksFilterValueSelector
								type={key}
								selectedValues={item.values}
								onToggleValue={(value) =>
									handleToggleFilterValue(
										filters,
										setArrayFilter,
										key,
										index,
										value,
									)
								}
							>
								{button}
							</TasksFilterValueSelector>
						)}
					/>
				));
			})}

			{filters.dateRange &&
				(filters.dateRange.start || filters.dateRange.end) && (
					<SharedDateRangeFilterChip
						dateRange={filters.dateRange}
						onClear={() =>
							handleClearFilterType("dateRange", setArrayFilter, setDateRange)
						}
						onIsNotToggle={() => {
							if (!filters.dateRange) return;
							setDateRange({
								...filters.dateRange,
								isNot: !filters.dateRange.isNot,
							});
						}}
					/>
				)}
		</div>
	);
}
