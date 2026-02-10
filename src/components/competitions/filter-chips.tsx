import { SharedFilterChip } from "@/components/shared/filters/filter-chip";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "@/hooks/use-convex-data";
import type { CompetitionPhaseKey, User } from "@/data/types-new";
import { getPhaseClass, getPhaseLabel } from "@/lib/competition-phase-config";
import { type FilterType, filterConfigs } from "@/lib/filter-config";
import { renderUserValueForFilter } from "@/lib/user-render-utils";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";
import {
	handleToggleFilter,
	handleToggleFilterValue,
	handleToggleFilterIsNot,
	handleClearFilterType,
} from "@/lib/filter-handlers";
import { DateFilterChip } from "./date-filter-chip";
import { FilterValueSelector } from "./filter-value-selector";

type FilterTypeConfig = {
	renderValue: (value: string, users?: User[]) => React.ReactNode;
	getIcon: (value?: string) => React.ComponentType<{ className?: string }>;
};

type FilterTypeConfigMap = Record<
	"phase" | "compLead" | "leadDelegate" | "organisers",
	FilterTypeConfig
>;

const filterTypeConfigs: FilterTypeConfigMap = {
	phase: {
		renderValue: (value) => {
			const key = value as CompetitionPhaseKey;
			return <Badge className={getPhaseClass(key)}>{getPhaseLabel(key)}</Badge>;
		},
		getIcon: () => filterConfigs.phase.icon,
	},
	compLead: {
		renderValue: renderUserValueForFilter,
		getIcon: () => filterConfigs.compLead.icon,
	},
	leadDelegate: {
		renderValue: renderUserValueForFilter,
		getIcon: () => filterConfigs.leadDelegate.icon,
	},
	organisers: {
		renderValue: renderUserValueForFilter,
		getIcon: () => filterConfigs.organisers.icon,
	},
};

export function FilterChips() {
	const { filters, setArrayFilter, setDateRange } = useCompetitionsUrlContext();
	const { users } = useUsers();

	const hasActiveFilters =
		filters.phase.length > 0 ||
		filters.compLead.length > 0 ||
		filters.leadDelegate.length > 0 ||
		filters.organisers.length > 0 ||
		filters.dateRange !== undefined;

	if (!hasActiveFilters) {
		return null;
	}

	const filterTypes: FilterType[] = [
		"phase",
		"compLead",
		"leadDelegate",
		"organisers",
	];

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{filterTypes.map((type) => {
				const config = filterConfigs[type];
				const filterItems = filters[type];
				const typeConfig = filterTypeConfigs[type];

				return filterItems.map((item, index) => {
					const Icon = typeConfig.getIcon(item.values[0]);
					return (
						<SharedFilterChip
							key={`${type}-${index}-${item.values.join(",")}`}
							icon={Icon}
							label={config.label}
							values={item.values}
							isNot={item.isNot}
							onToggleIsNot={() =>
								handleToggleFilterIsNot(filters, setArrayFilter, type, index)
							}
							onToggleValue={(value) =>
								handleToggleFilterValue(
									filters,
									setArrayFilter,
									type,
									index,
									value,
								)
							}
							onRemove={() => {
								item.values.forEach((value) => {
									handleToggleFilter(filters, setArrayFilter, type, value);
								});
							}}
							renderValue={(value) => typeConfig.renderValue(value, users)}
							wrapValueButton={(button) => (
								<FilterValueSelector
									type={type}
									selectedValues={item.values}
									onToggleValue={(value) =>
										handleToggleFilterValue(
											filters,
											setArrayFilter,
											type,
											index,
											value,
										)
									}
								>
									{button}
								</FilterValueSelector>
							)}
						/>
					);
				});
			})}
			{filters.dateRange &&
				(filters.dateRange.start || filters.dateRange.end) && (
					<DateFilterChip
						dateRange={filters.dateRange}
						onClear={() =>
							handleClearFilterType("dateRange", setArrayFilter, setDateRange)
						}
					/>
				)}
		</div>
	);
}
