import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/shared-filter-types";

export function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
	return !!dateRange && (!!dateRange.start || !!dateRange.end);
}

export function buildFilterItemMatcher<TValue, TItem>(
	filterItems: FilterItem<TValue>[],
	getValue: (item: TItem) => TValue | TValue[] | undefined,
	matchMode: MatchMode,
): (item: TItem) => boolean {
	if (filterItems.length === 0) {
		return () => true;
	}

	return (item: TItem) => {
		const raw = getValue(item);
		const itemValues: TValue[] =
			raw === undefined ? ([] as TValue[]) : Array.isArray(raw) ? raw : [raw];

		const matchesValues = (values: TValue[]) =>
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
