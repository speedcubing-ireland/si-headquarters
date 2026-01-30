import type { SharedFilterOption } from "@/components/shared/filters/filter-option-row";
import { SharedFilterOptionRow } from "@/components/shared/filters/filter-option-row";
import type { FilterOption, FilterType } from "@/lib/filter-config";

function toSharedOption(option: FilterOption<unknown>): SharedFilterOption {
	return {
		value: String(option.value),
		label: option.label,
		icon: option.icon,
		avatarUrl: option.avatarUrl,
	};
}

interface FilterOptionRowProps<T> {
	type: FilterType;
	option: FilterOption<T>;
	isSelected: boolean;
	onSelect: () => void;
}

export function FilterOptionRow<T>({
	option,
	isSelected,
	onSelect,
}: FilterOptionRowProps<T>) {
	return (
		<SharedFilterOptionRow
			option={toSharedOption(option as FilterOption<unknown>)}
			isSelected={isSelected}
			onSelect={onSelect}
		/>
	);
}
