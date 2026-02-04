import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterValueSelector } from "@/components/shared/filters/filter-value-selector";
import { useUsers } from "@/hooks/use-convex-data";
import {
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";

type FilterValueSelectorProps<T> = {
	type: FilterType;
	selectedValues: T[];
	onToggleValue: (value: T) => void;
	children: React.ReactNode;
};

export function FilterValueSelector<T extends string>({
	type,
	selectedValues,
	onToggleValue,
	children,
}: FilterValueSelectorProps<T>) {
	const config = filterConfigs[type];
	const { users } = useUsers();
	const options = mapToSharedFilterOptions(getFilterOptions(type, users));

	return (
		<SharedFilterValueSelector
			placeholder={config.placeholder}
			emptyMessage={config.emptyMessage}
			options={options}
			selectedValues={selectedValues.map(String)}
			onToggleValue={(value) => onToggleValue(value as T)}
		>
			{children}
		</SharedFilterValueSelector>
	);
}
