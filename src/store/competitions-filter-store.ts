import { create } from "zustand";
import type { Priority, Status } from "@/data/types";
import type {
	CompetitionsFilters,
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/competitions-filter-types";
import {
	getActiveFiltersCount as getActiveFiltersCountFromFilters,
	hasActiveFilters as hasActiveFiltersFromFilters,
} from "@/lib/competitions-filters";

export type FilterType = "status" | "priority" | "leads" | "date";

export interface CompetitionsFilterState {
	filters: CompetitionsFilters;
	matchMode: MatchMode;

	setFilter: (
		type: FilterType,
		values:
			| Status[]
			| Priority[]
			| string[]
			| { start?: string; end?: string; isNot?: boolean },
	) => void;
	toggleFilter: (
		type: "status" | "priority" | "leads",
		value: Status | Priority | string,
	) => void;
	toggleFilterValue: (
		type: "status" | "priority" | "leads",
		filterIndex: number,
		value: Status | Priority | string,
	) => void;
	toggleFilterIsNot: (
		type: "status" | "priority" | "leads",
		filterIndex: number,
	) => void;
	clearFilters: () => void;
	clearFilterType: (type: FilterType) => void;
	toggleMatchMode: () => void;

		hasActiveFilters: () => boolean;
		getActiveFiltersCount: () => number;

	toJSON: () => string;
	fromJSON: (json: string) => void;
}

export const useCompetitionsFilterStore = create<CompetitionsFilterState>(
	(set, get) => ({
		filters: {
			status: [],
			priority: [],
			leads: [],
			dateRange: undefined,
		},
		matchMode: "all",

		setFilter: (type, values) => {
			set((state) => {
				if (type === "date") {
					return {
						filters: {
							...state.filters,
							dateRange: values as DateRangeFilter,
						},
					};
				}
				// For status, priority, leads - convert array to FilterItem array if needed
				if (type === "status" || type === "priority" || type === "leads") {
					const arrayValues = values as Status[] | Priority[] | string[];
					// Check if it's already FilterItem format
					if (
						arrayValues.length > 0 &&
						typeof arrayValues[0] === "object" &&
						arrayValues[0] !== null &&
						"values" in arrayValues[0] &&
						"isNot" in arrayValues[0]
					) {
						return {
							filters: {
								...state.filters,
								[type]: arrayValues as unknown as FilterItem<
									Status | Priority | string
								>[],
							},
						};
					}
					// Otherwise create FilterItem with single value array
					const filterItems = arrayValues.map((value) => ({
						values: [value as never],
						isNot: false,
					}));
					return {
						filters: {
							...state.filters,
							[type]: filterItems,
						},
					};
				}
				return state;
			});
		},

		toggleFilter: (type, value) => {
			set((state) => {
				if (type === "status" || type === "priority" || type === "leads") {
					const current = state.filters[type];
					// Find if there's a filter item with this value
					const existingItemIndex = current.findIndex((item) =>
						item.values.includes(value as never),
					);

					if (existingItemIndex >= 0) {
						const existingItem = current[existingItemIndex];
						// Remove value from the item
						const newValues = existingItem.values.filter((v) => v !== value);
						if (newValues.length === 0) {
							// Remove the entire filter item if no values left
							return {
								filters: {
									...state.filters,
									[type]: current.filter((_, i) => i !== existingItemIndex),
								},
							};
						} else {
							// Update the item with remaining values
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
					} else {
						// Always create new filter item (no grouping)
						return {
							filters: {
								...state.filters,
								[type]: [
									...current,
									{ values: [value as never], isNot: false },
								],
							},
						};
					}
				}
				return state;
			});
		},

		toggleFilterValue: (
			type: "status" | "priority" | "leads",
			filterIndex: number,
			value: Status | Priority | string,
		) => {
			set((state) => {
				if (type === "status" || type === "priority" || type === "leads") {
					const current = state.filters[type];
					const item = current[filterIndex];
					if (!item) return state;

					const hasValue = item.values.includes(value as never);
					const newValues = hasValue
						? item.values.filter((v) => v !== value)
						: [...item.values, value as never];

					if (newValues.length === 0) {
						// Remove the filter item if no values left
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
				}
				return state;
			});
		},

		toggleFilterIsNot: (
			type: "status" | "priority" | "leads",
			filterIndex: number,
		) => {
			set((state) => {
				if (type === "status" || type === "priority" || type === "leads") {
					const current = state.filters[type];
					const updated = current.map((item, i) =>
						i === filterIndex ? { ...item, isNot: !item.isNot } : item,
					);
					return {
						filters: {
							...state.filters,
							[type]: updated,
						},
					};
				}
				return state;
			});
		},

		clearFilters: () => {
			set({
				filters: {
					status: [],
					priority: [],
					leads: [],
					dateRange: undefined,
				},
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
				if (type === "date") {
					return {
						filters: {
							...state.filters,
							dateRange: undefined,
						},
					};
				}
				return {
					filters: {
						...state.filters,
						[type]: [],
					},
				};
			});
		},

		hasActiveFilters: () => {
			const { filters } = get();
			return hasActiveFiltersFromFilters(filters);
		},

		getActiveFiltersCount: () => {
			const { filters } = get();
			return getActiveFiltersCountFromFilters(filters);
		},

		toJSON: () => {
			const { filters, matchMode } = get();
			return JSON.stringify({ filters, matchMode });
		},

		fromJSON: (json: string) => {
			try {
				const data = JSON.parse(json);
				set({
					filters: data.filters || {
						status: [],
						priority: [],
						leads: [],
						dateRange: undefined,
					},
					matchMode: data.matchMode || "all",
				});
			} catch (error) {
				console.error("Failed to parse filter JSON:", error);
			}
		},
	}),
);
