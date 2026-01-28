import type { CompetitionPhaseKey } from "@/data/types-new";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/shared-filter-types";

export type { DateRangeFilter, FilterItem, MatchMode };

export type CompetitionsFilters = {
	phase: FilterItem<CompetitionPhaseKey>[];
	compLead: FilterItem<string>[];
	leadDelegate: FilterItem<string>[];
	organisers: FilterItem<string>[];
	dateRange?: DateRangeFilter;
};

export const emptyCompetitionsFilters: CompetitionsFilters = {
	phase: [],
	compLead: [],
	leadDelegate: [],
	organisers: [],
	dateRange: undefined,
};
