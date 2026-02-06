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
import { TasksFilterValueSelector } from "./filter-value-selector";

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

	type ArrayFilterKey = Exclude<keyof TasksFilters, "dateRange">;

	const handleToggleFilter = <K extends ArrayFilterKey>(
		type: K,
		value: string,
	) => {
		const currentValues = filters[type];
		const existingItemIndex = currentValues.findIndex((item) =>
			item.values.includes(value),
		);

		if (existingItemIndex >= 0) {
			const existingItem = currentValues[existingItemIndex];
			const newValues = existingItem.values.filter((v) => v !== value);
			if (newValues.length === 0) {
				const newFilterValues = currentValues.filter(
					(_, i) => i !== existingItemIndex,
				);
				setArrayFilter(type, newFilterValues);
			} else {
				const newFilterValues = currentValues.map((item, i) =>
					i === existingItemIndex ? { ...item, values: newValues } : item,
				);
				setArrayFilter(type, newFilterValues);
			}
		} else {
			const newFilterValues = [
				...currentValues,
				{ values: [value], isNot: false },
			];
			setArrayFilter(type, newFilterValues);
		}
	};

	const handleToggleFilterValue = <K extends ArrayFilterKey>(
		type: K,
		filterIndex: number,
		value: string,
	) => {
		const currentValues = filters[type];
		const item = currentValues[filterIndex];
		if (!item) return;

		const hasValue = item.values.includes(value);
		const newValues = hasValue
			? item.values.filter((v) => v !== value)
			: [...item.values, value];

		if (newValues.length === 0) {
			const newFilterValues = currentValues.filter((_, i) => i !== filterIndex);
			setArrayFilter(type, newFilterValues);
		} else {
			const newFilterValues = currentValues.map((item, i) =>
				i === filterIndex ? { ...item, values: newValues } : item,
			);
			setArrayFilter(type, newFilterValues);
		}
	};

	const handleToggleFilterIsNot = <K extends ArrayFilterKey>(
		type: K,
		filterIndex: number,
	) => {
		const currentValues = filters[type];
		const newFilterValues = currentValues.map((item, i) =>
			i === filterIndex ? { ...item, isNot: !item.isNot } : item,
		);
		setArrayFilter(type, newFilterValues);
	};

	const handleClearFilterType = (type: keyof TasksFilters) => {
		if (type === "dateRange") {
			setDateRange(undefined);
		} else {
			setArrayFilter(type, []);
		}
	};

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{filters.status.map((item, index) => (
				<SharedFilterChip
					key={`status-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("status")?.displayIcon ?? (() => null)}
					label="Status"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => handleToggleFilterIsNot("status", index)}
					onToggleValue={(value) =>
						handleToggleFilterValue("status", index, value)
					}
					onRemove={() => {
						item.values.forEach((value) => {
							handleToggleFilter("status", value);
						});
					}}
					renderValue={(value) => getStatusBadge(value)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="status"
							selectedValues={item.values}
							onToggleValue={(value) =>
								handleToggleFilterValue("status", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.priority.map((item, index) => (
				<SharedFilterChip
					key={`priority-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("priority")?.displayIcon ?? (() => null)}
					label="Priority"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => handleToggleFilterIsNot("priority", index)}
					onToggleValue={(value) =>
						handleToggleFilterValue("priority", index, value)
					}
					onRemove={() => {
						item.values.forEach((value) => {
							handleToggleFilter("priority", value);
						});
					}}
					renderValue={(value) => (
						<span className="text-xs font-medium">
							{getPriorityLabel(value)}
						</span>
					)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="priority"
							selectedValues={item.values}
							onToggleValue={(value) =>
								handleToggleFilterValue("priority", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.assignee.map((item, index) => (
				<SharedFilterChip
					key={`assignee-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("assignee")?.displayIcon ?? (() => null)}
					label="Assignee"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => handleToggleFilterIsNot("assignee", index)}
					onToggleValue={(value) =>
						handleToggleFilterValue("assignee", index, value)
					}
					onRemove={() => {
						item.values.forEach((value) => {
							handleToggleFilter("assignee", value);
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
								handleToggleFilterValue("assignee", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.labels.map((item, index) => (
				<SharedFilterChip
					key={`labels-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("labels")?.displayIcon ?? (() => null)}
					label="Labels"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => handleToggleFilterIsNot("labels", index)}
					onToggleValue={(value) =>
						handleToggleFilterValue("labels", index, value)
					}
					onRemove={() => {
						item.values.forEach((value) => {
							handleToggleFilter("labels", value);
						});
					}}
					renderValue={(value) => renderLabel(value, filterContext.labels)}
					wrapValueButton={(button) => (
						<TasksFilterValueSelector
							type="labels"
							selectedValues={item.values}
							onToggleValue={(value) =>
								handleToggleFilterValue("labels", index, value)
							}
						>
							{button}
						</TasksFilterValueSelector>
					)}
				/>
			))}

			{filters.owner.map((item, index) => (
				<SharedFilterChip
					key={`owner-${index}-${item.values.join(",")}`}
					icon={getFilterConfig("owner")?.displayIcon ?? (() => null)}
					label="Owner"
					values={item.values}
					isNot={item.isNot}
					onToggleIsNot={() => handleToggleFilterIsNot("owner", index)}
					onToggleValue={(value) =>
						handleToggleFilterValue("owner", index, value)
					}
					onRemove={() => {
						item.values.forEach((value) => {
							handleToggleFilter("owner", value);
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
								handleToggleFilterValue("owner", index, value)
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
						onClear={() => handleClearFilterType("dateRange")}
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
