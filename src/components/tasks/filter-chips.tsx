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
import { useTasksPageContext } from "@/store/tasks-page-context";
import { TasksFilterValueSelector } from "./filter-value-selector";

function getStatusBadge(status: TaskStatus) {
	const className = statusColors[status];
	return <Badge className={className}>{statusLabels[status]}</Badge>;
}

function getPriorityLabel(priority: TaskPriority) {
	return priorityLabels[priority];
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
	const { filterStore } = useTasksPageContext();
	const filters = filterStore((state) => state.filters);
	const setFilter = filterStore((state) => state.setFilter);
	const toggleFilter = filterStore((state) => state.toggleFilter);
	const toggleFilterValue = filterStore((state) => state.toggleFilterValue);
	const toggleFilterIsNot = filterStore((state) => state.toggleFilterIsNot);
	const clearFilterType = filterStore((state) => state.clearFilterType);
	const hasActiveFilters = filterStore((state) => state.hasActiveFilters());
	const filterContext = useTaskFilterContext();

	if (!hasActiveFilters) return null;

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{filters.status.map((item, index) => (
				<SharedFilterChip<TaskStatus>
					key={`status-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("status")?.displayIcon ?? (() => null)}
					label="Status"
					values={item.values as TaskStatus[]}
					isNot={item.isNot}
					onToggleIsNot={() => toggleFilterIsNot("status", index)}
					onToggleValue={(value) => toggleFilterValue("status", index, value)}
					onRemove={() => {
						item.values.forEach((value) => {
							toggleFilter("status", value);
						});
					}}
					renderValue={(value) => getStatusBadge(value as TaskStatus)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="status"
							selectedValues={item.values as TaskStatus[]}
							onToggleValue={(value) =>
								toggleFilterValue("status", index, value as TaskStatus)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.priority.map((item, index) => (
				<SharedFilterChip<TaskPriority>
					key={`priority-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("priority")?.displayIcon ?? (() => null)}
					label="Priority"
					values={item.values as TaskPriority[]}
					isNot={item.isNot}
					onToggleIsNot={() => toggleFilterIsNot("priority", index)}
					onToggleValue={(value) => toggleFilterValue("priority", index, value)}
					onRemove={() => {
						item.values.forEach((value) => {
							toggleFilter("priority", value);
						});
					}}
					renderValue={(value) => (
						<span className="text-xs font-medium">
							{getPriorityLabel(value as TaskPriority)}
						</span>
					)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="priority"
							selectedValues={item.values as TaskPriority[]}
							onToggleValue={(value) =>
								toggleFilterValue("priority", index, value as TaskPriority)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.assignee.map((item, index) => (
				<SharedFilterChip<string>
					key={`assignee-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("assignee")?.displayIcon ?? (() => null)}
					label="Assignee"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => toggleFilterIsNot("assignee", index)}
					onToggleValue={(value) => toggleFilterValue("assignee", index, value)}
					onRemove={() => {
						item.values.forEach((value) => {
							toggleFilter("assignee", value);
						});
					}}
					renderValue={(value) =>
						renderUserValueByIdForFilter(value, filterContext.users)
					}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="assignee"
							selectedValues={item.values}
							onToggleValue={(value) =>
								toggleFilterValue("assignee", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.labels.map((item, index) => (
				<SharedFilterChip<string>
					key={`labels-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("labels")?.displayIcon ?? (() => null)}
					label="Labels"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => toggleFilterIsNot("labels", index)}
					onToggleValue={(value) => toggleFilterValue("labels", index, value)}
					onRemove={() => {
						item.values.forEach((value) => {
							toggleFilter("labels", value);
						});
					}}
					renderValue={(value) => renderLabel(value, filterContext.labels)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="labels"
							selectedValues={item.values}
							onToggleValue={(value) =>
								toggleFilterValue("labels", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.owner.map((item, index) => (
				<SharedFilterChip<string>
					key={`owner-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("owner")?.displayIcon ?? (() => null)}
					label="Owner"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => toggleFilterIsNot("owner", index)}
					onToggleValue={(value) => toggleFilterValue("owner", index, value)}
					onRemove={() => {
						item.values.forEach((value) => {
							toggleFilter("owner", value);
						});
					}}
					renderValue={(value) =>
						renderUserValueByIdForFilter(value, filterContext.users)
					}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="owner"
							selectedValues={item.values}
							onToggleValue={(value) =>
								toggleFilterValue("owner", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.dateRange &&
				(filters.dateRange.start || filters.dateRange.end) && (
					<SharedDateRangeFilterChip
						dateRange={filters.dateRange}
						onClear={() => clearFilterType("date")}
						onIsNotToggle={() =>
							setFilter("date", {
								...filters.dateRange,
								isNot: !(filters.dateRange?.isNot ?? false),
							})
						}
					/>
				)}
		</div>
	);
}
