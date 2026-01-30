import { SharedDateRangeFilterChip } from "@/components/shared/filters/date-range-filter-chip";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import type { DateRangeFilter } from "@/store/competitions-filter-types";

interface DateFilterChipProps {
	dateRange: DateRangeFilter;
	onClear: () => void;
}

export function DateFilterChip({ dateRange, onClear }: DateFilterChipProps) {
	const setFilter = useCompetitionsFilterStore((state) => state.setFilter);

	return (
		<SharedDateRangeFilterChip
			dateRange={dateRange}
			onClear={onClear}
			onIsNotChange={(isNot) => setFilter("date", { ...dateRange, isNot })}
		/>
	);
}
