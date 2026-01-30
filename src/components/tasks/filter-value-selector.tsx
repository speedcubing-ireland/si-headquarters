import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterValueSelector } from "@/components/shared/filters/filter-value-selector";
import { useDataV2 } from "@/data/data-store-v2";
import {
	getTaskFilterOptions,
	type TaskFilterType,
	taskFilterConfigs,
} from "@/lib/task-filter-config";

type TasksFilterValueSelectorProps<TValue extends string> = {
	type: TaskFilterType;
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
	const users = useDataV2((state) => state.users);
	const labels = useDataV2((state) => state.labels);

	const config = taskFilterConfigs[type];
	const options = mapToSharedFilterOptions(
		getTaskFilterOptions(type, users, labels),
	);

	return (
		<SharedFilterValueSelector
			placeholder={config.placeholder}
			emptyMessage={config.emptyMessage}
			options={options}
			selectedValues={selectedValues.map(String)}
			onToggleValue={(value) => onToggleValue(value as TValue)}
		>
			{children}
		</SharedFilterValueSelector>
	);
}
