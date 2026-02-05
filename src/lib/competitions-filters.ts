import type { Competition, CompetitionPhaseKey } from "@/data/types-new";
import { getCurrentPhaseKey } from "@/lib/competition-phase-config";
import type {
	CompetitionsFilters,
	DateRangeFilter,
	MatchMode,
} from "@/store/competitions-filter-types";
import {
	buildFilterItemMatcher,
	hasDateRangeValue,
} from "./shared-filter-engine";

type FilterState = CompetitionsFilters & {
	matchMode?: MatchMode;
};

export function hasActiveFilters(filters: CompetitionsFilters): boolean {
	return (
		filters.phase.length > 0 ||
		filters.compLead.length > 0 ||
		filters.leadDelegate.length > 0 ||
		filters.organisers.length > 0 ||
		hasDateRangeValue(filters.dateRange)
	);
}

export function getActiveFiltersCount(filters: CompetitionsFilters): number {
	let count =
		filters.phase.length +
		filters.compLead.length +
		filters.leadDelegate.length +
		filters.organisers.length;
	if (hasDateRangeValue(filters.dateRange)) {
		count += 1;
	}
	return count;
}

function buildDateMatcher(
	dateRange?: DateRangeFilter,
): (comp: Competition) => boolean {
	if (!hasDateRangeValue(dateRange)) {
		return () => true;
	}

	return (comp: Competition) => {
		if (!dateRange || !hasDateRangeValue(dateRange)) return true;
		if (!comp.compStart || !comp.compEnd) return false;

		const { start, end, isNot } = dateRange;
		const compStartTime = new Date(comp.compStart).getTime();
		const compEndTime = new Date(comp.compEnd).getTime();
		let matches = false;

		if (start && end) {
			const startTime = new Date(start).getTime();
			const endTime = new Date(end).getTime();
			matches = compStartTime <= endTime && compEndTime >= startTime;
		} else if (start) {
			const startTime = new Date(start).getTime();
			matches = compEndTime >= startTime;
		} else if (end) {
			const endTime = new Date(end).getTime();
			matches = compStartTime <= endTime;
		} else {
			matches = true;
		}

		return isNot ? !matches : matches;
	};
}

export function filterCompetitionsWithState(
	competitions: Competition[],
	filterState: FilterState,
): Competition[] {
	const { matchMode = "all", ...filters } = filterState;
	const result = filterCompetitions(competitions, filters, matchMode);

	return result;
}

function filterCompetitions(
	competitions: Competition[],
	filters: CompetitionsFilters,
	matchMode: MatchMode,
): Competition[] {
	const hasPhase = filters.phase.length > 0;
	const hasCompLead = filters.compLead.length > 0;
	const hasLeadDelegate = filters.leadDelegate.length > 0;
	const hasOrganisers = filters.organisers.length > 0;
	const hasDate = hasDateRangeValue(filters.dateRange);

	if (
		!hasPhase &&
		!hasCompLead &&
		!hasLeadDelegate &&
		!hasOrganisers &&
		!hasDate
	) {
		return competitions;
	}

	const matchesPhase = buildFilterItemMatcher<CompetitionPhaseKey, Competition>(
		filters.phase,
		(comp) => [getCurrentPhaseKey(comp)],
		matchMode,
	);

	const matchesCompLead = buildFilterItemMatcher<string, Competition>(
		filters.compLead,
		(comp) => (comp.compLead ? [comp.compLead.id] : []),
		matchMode,
	);

	const matchesLeadDelegate = buildFilterItemMatcher<string, Competition>(
		filters.leadDelegate,
		(comp) => (comp.leadDelegate ? [comp.leadDelegate.id] : []),
		matchMode,
	);

	const matchesOrganisers = buildFilterItemMatcher<string, Competition>(
		filters.organisers,
		(comp) => comp.organisers.map((u) => u.id),
		matchMode,
	);
	const matchesDate = buildDateMatcher(filters.dateRange);

	const potentialMatchers: Array<((comp: Competition) => boolean) | false> = [
		hasPhase && matchesPhase,
		hasCompLead && matchesCompLead,
		hasLeadDelegate && matchesLeadDelegate,
		hasOrganisers && matchesOrganisers,
		hasDate && matchesDate,
	];

	const activeMatchers = potentialMatchers.filter(
		(matcher): matcher is (comp: Competition) => boolean => Boolean(matcher),
	);

	if (activeMatchers.length === 0) {
		return competitions;
	}

	return competitions.filter((comp) =>
		matchMode === "all"
			? activeMatchers.every((matcher) => matcher(comp))
			: activeMatchers.some((matcher) => matcher(comp)),
	);
}
