import type { LucideIcon } from "lucide-react";
import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterSubMenu } from "@/components/shared/filters/filter-sub-menu";
import type {
	TaskFilterOption,
	TaskFilterType,
} from "@/lib/task-filter-config";

type TasksFilterSubMenuProps = {
	type: TaskFilterType;
	icon: LucideIcon;
	label: string;
	filterCount: number;
	placeholder: string;
	emptyMessage: string;
	options: TaskFilterOption[];
	selectedValues: string[];
	onToggleFilter: (type: TaskFilterType, value: string) => void;
};

export function TasksFilterSubMenu({
	type,
	icon: Icon,
	label,
	filterCount,
	placeholder,
	emptyMessage,
	options,
	selectedValues,
	onToggleFilter,
}: TasksFilterSubMenuProps) {
	return (
		<SharedFilterSubMenu
			icon={Icon}
			label={label}
			filterCount={filterCount}
			placeholder={placeholder}
			emptyMessage={emptyMessage}
			options={mapToSharedFilterOptions(options)}
			selectedValues={selectedValues}
			onToggleFilter={(value) => onToggleFilter(type, value)}
		/>
	);
}
