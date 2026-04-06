import type { Competition } from "@/data/types-new";
import { getCurrentPhaseKey } from "@/lib/competition-phase-config";
import type { CompetitionsFilters, DateRangeFilter } from "@/lib/filter-types";
import { createFilterEngine, hasDateRangeValue } from "./shared-filter-engine";

function buildDateMatcher(
	dateRange?: DateRangeFilter,
): (comp: Competition) => boolean {
	if (!hasDateRangeValue(dateRange)) return () => true;

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
			matches = compEndTime >= new Date(start).getTime();
		} else if (end) {
			matches = compStartTime <= new Date(end).getTime();
		} else {
			matches = true;
		}

		return isNot ? !matches : matches;
	};
}

const competitionEngine = createFilterEngine<Competition, CompetitionsFilters>(
	[
		{ key: "phase", getValue: (comp) => [getCurrentPhaseKey(comp)] },
		{
			key: "compLead",
			getValue: (comp) => (comp.compLead ? [comp.compLead.id] : []),
		},
		{
			key: "leadDelegate",
			getValue: (comp) => (comp.leadDelegate ? [comp.leadDelegate.id] : []),
		},
		{
			key: "organisers",
			getValue: (comp) =>
				comp.organisers.map((u: Competition["organisers"][number]) => u.id),
		},
	],
	buildDateMatcher,
);

export const filterCompetitionsWithState =
	competitionEngine.filterWithState.bind(competitionEngine);
