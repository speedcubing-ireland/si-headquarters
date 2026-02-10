import type { FilterItem, DateRangeFilter } from "@/lib/filter-types";

export type ArrayFilterSetter<K extends string> = (
	key: K,
	value: FilterItem[],
) => void;
type DateRangeSetter = (range: DateRangeFilter | undefined) => void;

export function handleToggleFilter<K extends string>(
	filters: NoInfer<Record<K, FilterItem[]>>,
	setArrayFilter: ArrayFilterSetter<K>,
	type: K,
	value: string,
): void {
	const currentValues = filters[type];
	const existingItemIndex = currentValues.findIndex((item) =>
		item.values.includes(value),
	);

	if (existingItemIndex >= 0) {
		const existingItem = currentValues[existingItemIndex];
		const newValues = existingItem.values.filter((v) => v !== value);
		if (newValues.length === 0) {
			setArrayFilter(
				type,
				currentValues.filter((_, i) => i !== existingItemIndex),
			);
		} else {
			setArrayFilter(
				type,
				currentValues.map((item, i) =>
					i === existingItemIndex ? { ...item, values: newValues } : item,
				),
			);
		}
	} else {
		setArrayFilter(type, [...currentValues, { values: [value], isNot: false }]);
	}
}

export function handleToggleFilterValue<K extends string>(
	filters: NoInfer<Record<K, FilterItem[]>>,
	setArrayFilter: ArrayFilterSetter<K>,
	type: K,
	filterIndex: number,
	value: string,
): void {
	const currentValues = filters[type];
	const item = currentValues[filterIndex];
	if (!item) return;

	const hasValue = item.values.includes(value);
	const newValues = hasValue
		? item.values.filter((v) => v !== value)
		: [...item.values, value];

	if (newValues.length === 0) {
		setArrayFilter(
			type,
			currentValues.filter((_, i) => i !== filterIndex),
		);
	} else {
		setArrayFilter(
			type,
			currentValues.map((item, i) =>
				i === filterIndex ? { ...item, values: newValues } : item,
			),
		);
	}
}

export function handleToggleFilterIsNot<K extends string>(
	filters: NoInfer<Record<K, FilterItem[]>>,
	setArrayFilter: ArrayFilterSetter<K>,
	type: K,
	filterIndex: number,
): void {
	const currentValues = filters[type];
	setArrayFilter(
		type,
		currentValues.map((item, i) =>
			i === filterIndex ? { ...item, isNot: !item.isNot } : item,
		),
	);
}

export function handleClearFilterType<K extends string>(
	type: NoInfer<K> | "dateRange",
	setArrayFilter: ArrayFilterSetter<K>,
	setDateRange: DateRangeSetter,
): void {
	if (type === "dateRange") {
		setDateRange(undefined);
	} else {
		setArrayFilter(type, []);
	}
}
