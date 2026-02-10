import type { CompetitionsFilters } from "@/lib/filter-types";
import { emptyCompetitionsFilters } from "@/lib/filter-types";
import type { DisplaySettings } from "@/lib/saved-view-utils";
import {
	createUrlHook,
	cloneFilterItems,
	cloneDateRange,
	type UrlState,
	type UrlActions,
} from "@/lib/create-url-hook";

export type CompetitionsUrlState = UrlState<CompetitionsFilters>;
export type CompetitionsUrlActions = UrlActions<CompetitionsFilters>;

export type UseCompetitionsUrlOptions = {
	pageId?: string;
	defaultFilters?: Partial<CompetitionsFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
};

function cloneCompetitionsFilters(
	filters: CompetitionsFilters,
): CompetitionsFilters {
	return {
		phase: cloneFilterItems(filters.phase),
		compLead: cloneFilterItems(filters.compLead),
		leadDelegate: cloneFilterItems(filters.leadDelegate),
		organisers: cloneFilterItems(filters.organisers),
		dateRange: cloneDateRange(filters.dateRange),
	};
}

function buildDefaultCompetitionsFilters(
	partial: Partial<CompetitionsFilters> | undefined,
	empty: CompetitionsFilters,
): CompetitionsFilters {
	return cloneCompetitionsFilters({
		phase: partial?.phase ?? empty.phase,
		compLead: partial?.compLead ?? empty.compLead,
		leadDelegate: partial?.leadDelegate ?? empty.leadDelegate,
		organisers: partial?.organisers ?? empty.organisers,
		dateRange: partial?.dateRange,
	});
}

export const useCompetitionsUrl = createUrlHook<CompetitionsFilters>(
	{
		emptyFilters: emptyCompetitionsFilters,
		cloneFilters: cloneCompetitionsFilters,
		buildDefaultFilters: buildDefaultCompetitionsFilters,
	},
	"all",
);
