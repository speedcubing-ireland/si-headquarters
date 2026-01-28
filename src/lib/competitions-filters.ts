import type { Competition, CompetitionPhaseKey } from "@/data/types-new";
import { getCurrentPhaseKey } from "@/lib/competition-phase-config";
import type {
	CompetitionsFilters,
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/competitions-filter-types";

type FilterState = CompetitionsFilters & {
	matchMode?: MatchMode;
};

function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
	return !!dateRange && (!!dateRange.start || !!dateRange.end);
}

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

function buildFilterItemMatcher<T extends string>(
	filterItems: FilterItem<T>[],
	getValue: (comp: Competition) => T | T[],
	matchMode: MatchMode,
): (comp: Competition) => boolean {
	if (filterItems.length === 0) {
		return () => true;
	}

	return (comp: Competition) => {
		const compValue = getValue(comp);

		const matchesValues = (values: T[]) =>
			Array.isArray(compValue)
				? compValue.some((val) => values.includes(val as T))
				: values.includes(compValue as T);

		const positiveItems = filterItems.filter((item) => !item.isNot);
		const negativeItems = filterItems.filter((item) => item.isNot);

		// Semantics (per filter type):
		// - Single chip with multiple values: OR ("is any of these")
		// - Multiple chips of same type:
		//   - Match all filters: AND across chips
		//   - Match any filter: OR across chips
		// - "is not"/exclusion chips are always enforced (AND across exclusions)
		const positiveMatch =
			positiveItems.length === 0
				? true
				: matchMode === "all"
					? positiveItems.every((item) => matchesValues(item.values))
					: positiveItems.some((item) => matchesValues(item.values));

		const negativeMatch = negativeItems.every(
			(item) => !matchesValues(item.values),
		);

		return positiveMatch && negativeMatch;
	};
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
			// Overlap between [compStart, compEnd] and [start, end]
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

export function filterCompetitions(
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

	const matchesPhase = buildFilterItemMatcher<CompetitionPhaseKey>(
		filters.phase,
		(comp) => [getCurrentPhaseKey(comp)],
		matchMode,
	);

	const matchesCompLead = buildFilterItemMatcher<string>(
		filters.compLead,
		(comp) => (comp.compLead ? [comp.compLead.id] : []),
		matchMode,
	);

	const matchesLeadDelegate = buildFilterItemMatcher<string>(
		filters.leadDelegate,
		(comp) => (comp.leadDelegate ? [comp.leadDelegate.id] : []),
		matchMode,
	);

	const matchesOrganisers = buildFilterItemMatcher<string>(
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

	return competitions.filter((comp) => {
		if (matchMode === "all") {
			// Match ALL filters: every matcher must return true (AND logic)
			return activeMatchers.every((matcher) => matcher(comp));
		}
		// Match ANY filter: at least one matcher must return true (OR logic)
		return activeMatchers.some((matcher) => matcher(comp));
	});
}
