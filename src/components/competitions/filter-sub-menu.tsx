import type { LucideIcon } from "lucide-react";
import { mapToSharedFilterOptions } from "@/components/shared/filters/filter-option-row";
import { SharedFilterSubMenu } from "@/components/shared/filters/filter-sub-menu";
import { useDataV2 } from "@/data/data-store-v2";
import {
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";

interface FilterSubMenuProps {
	type: FilterType;
	icon: LucideIcon;
	label: string;
	filterCount: number;
	onToggleFilter: (type: FilterType, value: string) => void;
	selectedValues: string[];
}

export function FilterSubMenu({
	type,
	icon: Icon,
	label,
	filterCount,
	onToggleFilter,
	selectedValues,
}: FilterSubMenuProps) {
	const config = filterConfigs[type];
	const users = useDataV2((state) => state.users);
	const options = mapToSharedFilterOptions(getFilterOptions(type, users));

	return (
		<SharedFilterSubMenu
			icon={Icon}
			label={label}
			filterCount={filterCount}
			placeholder={config.placeholder}
			emptyMessage={config.emptyMessage}
			options={options}
			selectedValues={selectedValues}
			onToggleFilter={(value) => onToggleFilter(type, value)}
		/>
	);
}
