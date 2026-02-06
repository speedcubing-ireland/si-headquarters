import { SharedDateRangeFilterChip } from "@/components/shared/filters/date-range-filter-chip";
import type { DateRangeFilter } from "@/lib/filter-types";

interface DateFilterChipProps {
	dateRange: DateRangeFilter;
	onClear: () => void;
	onIsNotToggle?: () => void;
}

export function DateFilterChip({
	dateRange,
	onClear,
	onIsNotToggle,
}: DateFilterChipProps) {
	return (
		<SharedDateRangeFilterChip
			dateRange={dateRange}
			onClear={onClear}
			onIsNotToggle={onIsNotToggle}
		/>
	);
}
