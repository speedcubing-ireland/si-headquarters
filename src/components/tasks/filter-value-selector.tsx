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

// Convert new TaskFilterValue format to old format for SharedFilterValueSelector
function mapToOldFormat(options: ReturnType<typeof getFilterValues>) {
	return options.map((opt) => ({
		value: opt.value,
		label: opt.label,
		icon:
			opt.iconType === "icon"
				? opt.icon
				: opt.iconType === "avatar"
					? null
					: null,
		avatarUrl: opt.iconType === "avatar" ? opt.avatarUrl : undefined,
		color: undefined,
	}));
}

export function TasksFilterValueSelector<TValue extends string>({
	type,
	selectedValues,
	onToggleValue,
	children,
}: TasksFilterValueSelectorProps<TValue>) {
	const filterContext = useTaskFilterContext();
	const config = getFilterConfig(type);
	const options = mapToSharedFilterOptions(
		mapToOldFormat(getFilterValues(type, filterContext)),
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
