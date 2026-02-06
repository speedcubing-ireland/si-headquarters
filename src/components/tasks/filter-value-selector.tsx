import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterValueSelector } from "@/components/shared/filters/filter-value-selector";
import { useTaskFilterContext } from "@/hooks/use-task-filter-context";
import {
	getFilterValues,
	getFilterConfig,
} from "@/lib/task-filter-definitions";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/data/types-new";

const TASK_PARENT_TYPES = ["task", "phase", "competition"] as const;

type TasksArrayFilterKey =
	| "status"
	| "priority"
	| "assignee"
	| "labels"
	| "owner"
	| "parentType";

const isTaskStatus = (value: string): boolean =>
	TASK_STATUSES.some((status) => status === value);

const isTaskPriority = (value: string): boolean =>
	TASK_PRIORITIES.some((priority) => priority === value);

const isParentType = (value: string): boolean =>
	TASK_PARENT_TYPES.some((type) => type === value);

type TasksFilterValueSelectorProps = {
	type: TasksArrayFilterKey;
	selectedValues: string[];
	onToggleValue: (value: string) => void;
	children: React.ReactNode;
};

function parseTaskFilterValue(
	type: TasksArrayFilterKey,
	value: string,
): string | null {
	switch (type) {
		case "status":
			return isTaskStatus(value) ? value : null;
		case "priority":
			return isTaskPriority(value) ? value : null;
		case "parentType":
			return isParentType(value) ? value : null;
		case "assignee":
		case "labels":
		case "owner":
			return value;
		default:
			return null;
	}
}

export function TasksFilterValueSelector({
	type,
	selectedValues,
	onToggleValue,
	children,
}: TasksFilterValueSelectorProps) {
	const filterContext = useTaskFilterContext();
	const config = getFilterConfig(type);
	const rawOptions = getFilterValues(type, filterContext);
	const parsedOptions = rawOptions.flatMap((option) => {
		const parsedValue = parseTaskFilterValue(type, option.value);
		if (!parsedValue) return [];
		return [
			{
				...option,
				value: parsedValue,
			},
		];
	});
	const options = mapToSharedFilterOptions(parsedOptions);

	return (
		<SharedFilterValueSelector
			placeholder={`Search ${config?.displayName.toLowerCase() ?? "..."}`}
			emptyMessage={`No ${config?.displayName.toLowerCase() ?? "items"} found.`}
			options={options}
			selectedValues={selectedValues}
			onToggleValue={onToggleValue}
		>
			{children}
		</SharedFilterValueSelector>
	);
}
