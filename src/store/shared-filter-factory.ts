import { create, type StoreApi, type UseBoundStore } from "zustand";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/shared-filter-types";

export interface BaseFilterStoreState<
	TFilters,
	TFilterType extends string,
	TValue,
> {
	filters: TFilters;
	matchMode: MatchMode;

	setFilter: (
		type: TFilterType,
		values:
			| TValue[]
			| string[]
			| { start?: string; end?: string; isNot?: boolean }
			| FilterItem<TValue | string>[],
	) => void;
	toggleFilter: (type: TFilterType, value: TValue | string) => void;
	toggleFilterValue: (
		type: TFilterType,
		filterIndex: number,
		value: TValue | string,
	) => void;
	toggleFilterIsNot: (type: TFilterType, filterIndex: number) => void;
	clearFilters: () => void;
	clearFilterType: (type: TFilterType) => void;
	toggleMatchMode: () => void;

	hasActiveFilters: () => boolean;
	getActiveFiltersCount: () => number;

	toJSON: () => string;
	fromJSON: (json: string) => void;
}

interface CreateFilterStoreOptions<TFilters, TFilterType extends string> {
	initialFilters: TFilters;
	/**
	 * The filter type that should write to `filters.dateRange`.
	 * Both competitions and tasks use a `date` filter type with this shape.
	 */
	dateFilterType: TFilterType;
	/**
	 * Which filter types support value toggling (status, priority, etc).
	 * The date filter is typically excluded here.
	 */
	toggleFilterTypes: TFilterType[];
	hasActiveFilters: (filters: TFilters) => boolean;
	getActiveFiltersCount: (filters: TFilters) => number;
}

export function createFilterStore<
	TFilterType extends string,
	TValue,
	TFilters extends { dateRange?: DateRangeFilter } & Record<string, unknown>,
>(
	options: CreateFilterStoreOptions<TFilters, TFilterType>,
): UseBoundStore<
	StoreApi<BaseFilterStoreState<TFilters, TFilterType, TValue>>
> {
	const {
		initialFilters,
		dateFilterType,
		toggleFilterTypes,
		hasActiveFilters,
		getActiveFiltersCount,
	} = options;

	return create<BaseFilterStoreState<TFilters, TFilterType, TValue>>(
		(set, get) => ({
			filters: initialFilters,
			matchMode: "all",

			setFilter: (type, values) => {
				set((state) => {
					if (type === dateFilterType) {
						return {
							filters: {
								...state.filters,
								dateRange: values as DateRangeFilter,
							},
						};
					}

					if (!toggleFilterTypes.includes(type)) {
						return state;
					}

					const arrayValues = values as
						| (TValue | string)[]
						| FilterItem<TValue | string>[];

					if (
						arrayValues.length > 0 &&
						typeof arrayValues[0] === "object" &&
						arrayValues[0] !== null &&
						"values" in (arrayValues[0] as FilterItem<TValue | string>) &&
						"isNot" in (arrayValues[0] as FilterItem<TValue | string>)
					) {
						return {
							filters: {
								...state.filters,
								[type]: arrayValues as FilterItem<TValue | string>[],
							},
						};
					}

					const primitiveValues = arrayValues as (TValue | string)[];
					const filterItems: FilterItem<TValue | string>[] =
						primitiveValues.map((value) => ({
							values: [value],
							isNot: false,
						}));

					return {
						filters: {
							...state.filters,
							[type]: filterItems,
						},
					};
				});
			},

			toggleFilter: (type, value) => {
				set((state) => {
					if (!toggleFilterTypes.includes(type)) {
						return state;
					}

					const current = state.filters[type] as FilterItem<TValue | string>[];
					const existingItemIndex = current.findIndex((item) =>
						item.values.includes(value),
					);

					if (existingItemIndex >= 0) {
						const existingItem = current[existingItemIndex];
						const newValues = existingItem.values.filter((v) => v !== value);
						if (newValues.length === 0) {
							return {
								filters: {
									...state.filters,
									[type]: current.filter((_, i) => i !== existingItemIndex),
								},
							};
						}

						return {
							filters: {
								...state.filters,
								[type]: current.map((item, i) =>
									i === existingItemIndex
										? { ...item, values: newValues }
										: item,
								),
							},
						};
					}

					return {
						filters: {
							...state.filters,
							[type]: [
								...current,
								{ values: [value], isNot: false } as FilterItem<
									TValue | string
								>,
							],
						},
					};
				});
			},

			toggleFilterValue: (type, filterIndex, value) => {
				set((state) => {
					if (!toggleFilterTypes.includes(type)) {
						return state;
					}

					const current = state.filters[type] as FilterItem<TValue | string>[];
					const item = current[filterIndex];
					if (!item) return state;

					const hasValue = item.values.includes(value);
					const newValues = hasValue
						? item.values.filter((v) => v !== value)
						: [...item.values, value];

					if (newValues.length === 0) {
						return {
							filters: {
								...state.filters,
								[type]: current.filter((_, i) => i !== filterIndex),
							},
						};
					}

					return {
						filters: {
							...state.filters,
							[type]: current.map((item, i) =>
								i === filterIndex ? { ...item, values: newValues } : item,
							),
						},
					};
				});
			},

			toggleFilterIsNot: (type, filterIndex) => {
				set((state) => {
					if (!toggleFilterTypes.includes(type)) {
						return state;
					}

					const current = state.filters[type] as FilterItem<TValue | string>[];
					const updated = current.map((item, i) =>
						i === filterIndex ? { ...item, isNot: !item.isNot } : item,
					);

					return {
						filters: {
							...state.filters,
							[type]: updated,
						},
					};
				});
			},

			clearFilters: () => {
				set({
					filters: initialFilters,
					matchMode: "all",
				});
			},

			toggleMatchMode: () => {
				set((state) => ({
					matchMode: state.matchMode === "any" ? "all" : "any",
				}));
			},

			clearFilterType: (type) => {
				set((state) => {
					if (type === dateFilterType) {
						return {
							filters: {
								...state.filters,
								dateRange: undefined,
							},
						};
					}

					if (!toggleFilterTypes.includes(type)) {
						return state;
					}

					return {
						filters: {
							...state.filters,
							[type]: [],
						},
					};
				});
			},

			hasActiveFilters: () => hasActiveFilters(get().filters),

			getActiveFiltersCount: () => getActiveFiltersCount(get().filters),

			toJSON: () => {
				const { filters, matchMode } = get();
				return JSON.stringify({ filters, matchMode });
			},

			fromJSON: (json: string) => {
				try {
					const data = JSON.parse(json);
					set({
						filters: (data.filters || initialFilters) as TFilters,
						matchMode: (data.matchMode as MatchMode | undefined) ?? "all",
					});
				} catch (error) {
					console.error("Failed to parse filter JSON:", error);
				}
			},
		}),
	);
}
