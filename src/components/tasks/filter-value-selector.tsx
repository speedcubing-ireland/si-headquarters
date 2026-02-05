import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterValueSelector } from "@/components/shared/filters/filter-value-selector";
import { useTaskFilterContext } from "@/hooks/use-task-filter-context";
import {
	getFilterValues,
	getFilterConfig,
} from "@/lib/task-filter-definitions";

type TasksFilterValueSelectorProps<TValue extends string> = {
	type: string;
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
	const filterContext = useTaskFilterContext();
	const config = getFilterConfig(type);
	const options = mapToSharedFilterOptions(
		getFilterValues(type, filterContext),
	);

	return (
		<SharedFilterValueSelector
			placeholder={`Search ${config?.displayName.toLowerCase() ?? "..."}`}
			emptyMessage={`No ${config?.displayName.toLowerCase() ?? "items"} found.`}
			options={options}
			selectedValues={selectedValues.map(String)}
			onToggleValue={(value) => onToggleValue(value as TValue)}
		>
			{children}
		</SharedFilterValueSelector>
	);
}
