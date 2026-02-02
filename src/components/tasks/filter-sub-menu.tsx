import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterSubMenu } from "@/components/shared/filters/filter-sub-menu";
import type {
	TaskFilterType,
	TaskFilterValue,
} from "@/lib/task-filter-definitions";

type TasksFilterSubMenuProps = {
	filterType: TaskFilterType;
	filterCount: number;
	options: TaskFilterValue[];
	selectedValues: string[];
	onToggleFilter: (type: string, value: string) => void;
};

// Convert new TaskFilterValue format to old TaskFilterOption format for SharedFilterSubMenu
function mapToOldFormat(options: TaskFilterValue[]) {
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

export function TasksFilterSubMenu({
	filterType,
	filterCount,
	options,
	selectedValues,
	onToggleFilter,
}: TasksFilterSubMenuProps) {
	return (
		<SharedFilterSubMenu
			icon={filterType.displayIcon}
			label={filterType.displayName}
			filterCount={filterCount}
			placeholder="Search"
			emptyMessage={`No ${filterType.displayName.toLowerCase()} found.`}
			options={mapToSharedFilterOptions(mapToOldFormat(options))}
			selectedValues={selectedValues}
			onToggleFilter={(value) => onToggleFilter(filterType.id, value)}
		/>
	);
}
