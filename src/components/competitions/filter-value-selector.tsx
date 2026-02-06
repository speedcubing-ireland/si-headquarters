import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterValueSelector } from "@/components/shared/filters/filter-value-selector";
import { useUsers } from "@/hooks/use-convex-data";
import {
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";
import { COMPETITION_PHASE_KEYS } from "@/data/types-new";

const isCompetitionPhaseKey = (value: string): boolean =>
	COMPETITION_PHASE_KEYS.some((key) => key === value);

function parseFilterValue(type: FilterType, value: string): string | null {
	switch (type) {
		case "phase":
			return isCompetitionPhaseKey(value) ? value : null;
		case "compLead":
		case "leadDelegate":
		case "organisers":
			return value;
		default:
			return null;
	}
}

type FilterValueSelectorProps = {
	type: FilterType;
	selectedValues: string[];
	onToggleValue: (value: string) => void;
	children: React.ReactNode;
};

export function FilterValueSelector({
	type,
	selectedValues,
	onToggleValue,
	children,
}: FilterValueSelectorProps) {
	const config = filterConfigs[type];
	const { users } = useUsers();
	const rawOptions = getFilterOptions(type, users);
	const parsedOptions = rawOptions.flatMap((option) => {
		const parsedValue = parseFilterValue(type, option.value);
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
			placeholder={config.placeholder}
			emptyMessage={config.emptyMessage}
			options={options}
			selectedValues={selectedValues}
			onToggleValue={onToggleValue}
		>
			{children}
		</SharedFilterValueSelector>
	);
}
