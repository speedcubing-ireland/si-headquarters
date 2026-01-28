import type { Project, Status, Priority } from "@/data/types";
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
		filters.status.length > 0 ||
		filters.priority.length > 0 ||
		filters.leads.length > 0 ||
		hasDateRangeValue(filters.dateRange)
	);
}

export function getActiveFiltersCount(filters: CompetitionsFilters): number {
	let count =
		filters.status.length + filters.priority.length + filters.leads.length;
	if (hasDateRangeValue(filters.dateRange)) {
		count += 1;
	}
	return count;
}

function buildFilterItemMatcher<T extends Status | Priority | string>(
	filterItems: FilterItem<T>[],
	getValue: (comp: Project) => T | T[],
): (comp: Project) => boolean {
	if (filterItems.length === 0) {
		return () => true;
	}

	return (comp: Project) =>
		filterItems.every((item) => {
			const compValue = getValue(comp);
			const matches = Array.isArray(compValue)
				? compValue.some((val) => item.values.includes(val as T))
				: item.values.includes(compValue as T);
			return item.isNot ? !matches : matches;
		});
}

function buildDateMatcher(dateRange?: DateRangeFilter): (comp: Project) => boolean {
	if (!hasDateRangeValue(dateRange)) {
		return () => true;
	}

	return (comp: Project) => {
		if (!dateRange || !hasDateRangeValue(dateRange)) return true;
		if (!comp.startDate) return false;

		const { start, end, isNot } = dateRange;
		const compTime = new Date(comp.startDate).getTime();
		let matches = false;

		if (start && end) {
			const startTime = new Date(start).getTime();
			const endTime = new Date(end).getTime();
			matches = compTime >= startTime && compTime <= endTime;
		} else if (start) {
			const startTime = new Date(start).getTime();
			matches = compTime >= startTime;
		} else if (end) {
			const endTime = new Date(end).getTime();
			matches = compTime <= endTime;
		} else {
			matches = true;
		}

		return isNot ? !matches : matches;
	};
}

export function filterCompetitionsWithState(
	competitions: Project[],
	filterState: FilterState,
): Project[] {
	const { matchMode = "any", ...filters } = filterState;
	return filterCompetitions(competitions, filters, matchMode);
}

export function filterCompetitions(
	competitions: Project[],
	filters: CompetitionsFilters,
	matchMode: MatchMode,
): Project[] {
	const hasStatus = filters.status.length > 0;
	const hasPriority = filters.priority.length > 0;
	const hasLeads = filters.leads.length > 0;
	const hasDate = hasDateRangeValue(filters.dateRange);

	if (!hasStatus && !hasPriority && !hasLeads && !hasDate) {
		return competitions;
	}

	const matchesStatus = buildFilterItemMatcher<Status>(
		filters.status,
		(comp) => comp.status,
	);
	const matchesPriority = buildFilterItemMatcher<Priority>(
		filters.priority,
		(comp) => comp.priority,
	);
	const matchesLeads = buildFilterItemMatcher<string>(
		filters.leads,
		(comp) => comp.leads.map((lead) => lead.name),
	);
	const matchesDate = buildDateMatcher(filters.dateRange);

	const activeMatchers = [
		hasStatus && matchesStatus,
		hasPriority && matchesPriority,
		hasLeads && matchesLeads,
		hasDate && matchesDate,
	].filter(Boolean) as ((comp: Project) => boolean)[];

	if (activeMatchers.length === 0) {
		return competitions;
	}

	return competitions.filter((comp) =>
		matchMode === "all"
			? activeMatchers.every((matcher) => matcher(comp))
			: activeMatchers.some((matcher) => matcher(comp)),
	);
}

