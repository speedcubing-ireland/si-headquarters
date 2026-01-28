import {
	getActiveFiltersCount as getActiveFiltersCountFromFilters,
	hasActiveFilters as hasActiveFiltersFromFilters,
} from "@/lib/competitions-filters";
import type { CompetitionsFilters } from "@/store/competitions-filter-types";
import { emptyCompetitionsFilters } from "@/store/competitions-filter-types";
import { createFilterStore } from "@/store/shared-filter-factory";

export type FilterType =
	| "phase"
	| "compLead"
	| "leadDelegate"
	| "organisers"
	| "date";

export const useCompetitionsFilterStore = createFilterStore<
	FilterType,
	string,
	CompetitionsFilters
>({
	initialFilters: emptyCompetitionsFilters,
	dateFilterType: "date",
	toggleFilterTypes: ["phase", "compLead", "leadDelegate", "organisers"],
	hasActiveFilters: hasActiveFiltersFromFilters,
	getActiveFiltersCount: getActiveFiltersCountFromFilters,
});
