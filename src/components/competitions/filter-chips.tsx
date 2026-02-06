import { SharedFilterChip } from "@/components/shared/filters/filter-chip";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "@/hooks/use-convex-data";
import type { CompetitionPhaseKey, User } from "@/data/types-new";
import { getPhaseClass, getPhaseLabel } from "@/lib/competition-phase-config";
import { type FilterType, filterConfigs } from "@/lib/filter-config";
import { renderUserValueForFilter } from "@/lib/user-render-utils";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";
import type { CompetitionsFilters } from "@/lib/filter-types";
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

	type ArrayFilterKey = Exclude<keyof CompetitionsFilters, "dateRange">;

	const handleToggleFilter = <K extends ArrayFilterKey>(
		type: K,
		value: string,
	) => {
		const currentValues = filters[type];
		const existingItemIndex = currentValues.findIndex((item) =>
			item.values.includes(value),
		);

		if (existingItemIndex >= 0) {
			const existingItem = currentValues[existingItemIndex];
			const newValues = existingItem.values.filter((v) => v !== value);
			if (newValues.length === 0) {
				const newFilterValues = currentValues.filter(
					(_, i) => i !== existingItemIndex,
				);
				setArrayFilter(type, newFilterValues);
			} else {
				const newFilterValues = currentValues.map((item, i) =>
					i === existingItemIndex ? { ...item, values: newValues } : item,
				);
				setArrayFilter(type, newFilterValues);
			}
		} else {
			const newFilterValues = [
				...currentValues,
				{ values: [value], isNot: false },
			];
			setArrayFilter(type, newFilterValues);
		}
	};

	const handleToggleFilterValue = <K extends ArrayFilterKey>(
		type: K,
		filterIndex: number,
		value: string,
	) => {
		const currentValues = filters[type];
		const item = currentValues[filterIndex];
		if (!item) return;

		const hasValue = item.values.includes(value);
		const newValues = hasValue
			? item.values.filter((v) => v !== value)
			: [...item.values, value];

		if (newValues.length === 0) {
			const newFilterValues = currentValues.filter((_, i) => i !== filterIndex);
			setArrayFilter(type, newFilterValues);
		} else {
			const newFilterValues = currentValues.map((item, i) =>
				i === filterIndex ? { ...item, values: newValues } : item,
			);
			setArrayFilter(type, newFilterValues);
		}
	};

	const handleToggleFilterIsNot = <K extends ArrayFilterKey>(
		type: K,
		filterIndex: number,
	) => {
		const currentValues = filters[type];
		const newFilterValues = currentValues.map((item, i) =>
			i === filterIndex ? { ...item, isNot: !item.isNot } : item,
		);
		setArrayFilter(type, newFilterValues);
	};

	const handleClearFilterType = (type: keyof CompetitionsFilters) => {
		if (type === "dateRange") {
			setDateRange(undefined);
		} else {
			setArrayFilter(type, []);
		}
	};

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
							onToggleIsNot={() => handleToggleFilterIsNot(type, index)}
							onToggleValue={(value) =>
								handleToggleFilterValue(type, index, value)
							}
							onRemove={() => {
								item.values.forEach((value) => {
									handleToggleFilter(type, value);
								});
							}}
							renderValue={(value) => typeConfig.renderValue(value, users)}
							wrapValueButton={(button) => (
								<FilterValueSelector
									type={type}
									selectedValues={item.values}
									onToggleValue={(value) =>
										handleToggleFilterValue(type, index, value)
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
						onClear={() => handleClearFilterType("dateRange")}
					/>
				)}
		</div>
	);
}
