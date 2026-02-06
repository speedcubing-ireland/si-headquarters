import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/lib/filter-types";

export function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
	return !!dateRange && (!!dateRange.start || !!dateRange.end);
}

export function buildFilterItemMatcher<TItem>(
	filterItems: FilterItem[],
	getValue: (item: TItem) => string | string[] | undefined,
	matchMode: MatchMode,
): (item: TItem) => boolean {
	if (filterItems.length === 0) {
		return () => true;
	}

	return (item: TItem) => {
		const raw = getValue(item);
		const itemValues: string[] =
			raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

		const matchesValues = (values: string[]) =>
			itemValues.some((v) => values.includes(v));

		const positiveItems = filterItems.filter((f) => !f.isNot);
		const negativeItems = filterItems.filter((f) => f.isNot);

		const positiveMatch =
			positiveItems.length === 0
				? true
				: matchMode === "all"
					? positiveItems.every((f) => matchesValues(f.values))
					: positiveItems.some((f) => matchesValues(f.values));

		const negativeMatch = negativeItems.every((f) => !matchesValues(f.values));

		return positiveMatch && negativeMatch;
	};
}
