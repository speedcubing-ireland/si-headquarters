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

type FieldConfig<TItem> = {
	key: string;
	getValue: (item: TItem) => string | string[] | undefined;
};

type FiltersWithDateRange = {
	dateRange?: DateRangeFilter;
	[key: string]: FilterItem[] | DateRangeFilter | undefined;
};

export function createFilterEngine<
	TItem,
	TFilters extends FiltersWithDateRange,
>(
	fields: FieldConfig<TItem>[],
	buildDateMatcher: (dateRange?: DateRangeFilter) => (item: TItem) => boolean,
) {
	return {
		filter(items: TItem[], filters: TFilters, matchMode: MatchMode): TItem[] {
			const activeEntries: Array<{ key: string; items: FilterItem[] }> = [];
			for (const field of fields) {
				const val = filters[field.key];
				if (Array.isArray(val) && val.length > 0) {
					activeEntries.push({ key: field.key, items: val });
				}
			}
			const hasDate = hasDateRangeValue(filters.dateRange);

			if (activeEntries.length === 0 && !hasDate) {
				return items;
			}

			const fieldsByKey = new Map(fields.map((f) => [f.key, f]));
			const matchers: Array<(item: TItem) => boolean> = activeEntries.map(
				(entry) => {
					const field = fieldsByKey.get(entry.key);
					if (!field) return () => true;
					return buildFilterItemMatcher(entry.items, field.getValue, matchMode);
				},
			);

			if (hasDate) {
				matchers.push(buildDateMatcher(filters.dateRange));
			}

			return items.filter((item) =>
				matchMode === "all"
					? matchers.every((m) => m(item))
					: matchers.some((m) => m(item)),
			);
		},

		filterWithState(
			items: TItem[],
			filterState: TFilters & { matchMode?: MatchMode },
		): TItem[] {
			const { matchMode = "all", ...filters } = filterState;
			return this.filter(items, filters as TFilters, matchMode);
		},
	};
}
