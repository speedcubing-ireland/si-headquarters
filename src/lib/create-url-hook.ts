import { useCallback, useEffect, useMemo } from "react";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/lib/filter-types";
import {
	type DisplaySettings,
	defaultDisplaySettings as DEFAULT_DISPLAY_SETTINGS,
} from "@/lib/saved-view-utils";
import { createListStateStore } from "@/store/create-list-state-store";

export function cloneFilterItem(item: FilterItem): FilterItem {
	return { values: [...item.values], isNot: item.isNot };
}

export function cloneFilterItems(items: FilterItem[]): FilterItem[] {
	return items.map(cloneFilterItem);
}

export function cloneDateRange(
	dateRange: DateRangeFilter | undefined,
): DateRangeFilter | undefined {
	if (!dateRange) return undefined;
	return { start: dateRange.start, end: dateRange.end, isNot: dateRange.isNot };
}

function cloneDisplaySettings(settings: DisplaySettings): DisplaySettings {
	return {
		grouping: settings.grouping,
		subGrouping: settings.subGrouping,
		ordering: {
			field: settings.ordering.field,
			direction: settings.ordering.direction,
		},
	};
}

function buildDefaultDisplaySettings(
	partial: Partial<DisplaySettings> | undefined,
): DisplaySettings {
	const ordering = partial?.ordering;
	return {
		grouping: partial?.grouping ?? DEFAULT_DISPLAY_SETTINGS.grouping,
		subGrouping: partial?.subGrouping ?? DEFAULT_DISPLAY_SETTINGS.subGrouping,
		ordering: {
			field: ordering?.field ?? DEFAULT_DISPLAY_SETTINGS.ordering.field,
			direction:
				ordering?.direction === "desc"
					? "desc"
					: DEFAULT_DISPLAY_SETTINGS.ordering.direction,
		},
	};
}

export interface UrlState<TFilters> {
	filters: TFilters;
	matchMode: MatchMode;
	displaySettings: DisplaySettings;
	viewId: string | null;
	isViewActive: boolean;
}

export interface UrlActions<TFilters extends { dateRange?: DateRangeFilter }> {
	setArrayFilter: (
		key: Exclude<keyof TFilters, "dateRange">,
		value: FilterItem[],
	) => void;
	setFiltersAndMatch: (filters: TFilters, matchMode: MatchMode) => void;
	setMatchMode: (mode: MatchMode) => void;
	setDateRange: (range: DateRangeFilter | undefined) => void;
	setDisplaySettings: (settings: DisplaySettings) => void;
	replaceAll: (next: {
		viewId: string | null;
		filters: TFilters;
		matchMode: MatchMode;
		displaySettings: DisplaySettings;
	}) => void;
	setGrouping: (grouping: string | null) => void;
	setSubGrouping: (subGrouping: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	setView: (viewId: string | null) => void;
	clearFilters: () => void;
	clearAll: () => void;
}

export interface CreateUrlHookConfig<
	TFilters extends { dateRange?: DateRangeFilter },
> {
	emptyFilters: TFilters;
	cloneFilters: (filters: TFilters) => TFilters;
	buildDefaultFilters: (
		partial: Partial<TFilters> | undefined,
		empty: TFilters,
	) => TFilters;
}

export interface UseUrlHookOptions<TFilters> {
	pageId?: string;
	defaultFilters?: Partial<TFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
}

export function createUrlHook<TFilters extends { dateRange?: DateRangeFilter }>(
	config: CreateUrlHookConfig<TFilters>,
	defaultPageId = "default",
) {
	const store = createListStateStore<TFilters>({
		cloneFilters: config.cloneFilters,
	});

	return function useUrl(
		options: UseUrlHookOptions<TFilters> = {},
	): UrlState<TFilters> & UrlActions<TFilters> {
		const pageId = options.pageId ?? defaultPageId;

		const ensurePage = store((s) => s.ensurePage);
		const updatePage = store((s) => s.updatePage);
		const resetPage = store((s) => s.resetPage);
		const pageState = store((s) => s.pages[pageId]);

		const baseFilters = useMemo(
			() =>
				config.buildDefaultFilters(options.defaultFilters, config.emptyFilters),
			[options.defaultFilters],
		);
		const baseDisplaySettings = useMemo(
			() => buildDefaultDisplaySettings(options.defaultDisplaySettings),
			[options.defaultDisplaySettings],
		);

		useEffect(() => {
			ensurePage(pageId, { baseFilters, baseDisplaySettings });
		}, [ensurePage, pageId, baseFilters, baseDisplaySettings]);

		const fallbackState = useMemo(
			() => ({
				filters: config.cloneFilters(baseFilters),
				matchMode: "all" as MatchMode,
				displaySettings: cloneDisplaySettings(baseDisplaySettings),
				viewId: null,
			}),
			[baseFilters, baseDisplaySettings],
		);

		const currentState = pageState ?? fallbackState;

		const setArrayFilter: UrlActions<TFilters>["setArrayFilter"] = useCallback(
			(key, value) => {
				updatePage(pageId, (current) => ({
					...current,
					filters: {
						...current.filters,
						[key]: cloneFilterItems(value),
					},
				}));
			},
			[pageId, updatePage],
		);

		const setFiltersAndMatch = useCallback(
			(filters: TFilters, matchMode: MatchMode) => {
				updatePage(pageId, (current) => ({
					...current,
					filters: config.cloneFilters(filters),
					matchMode,
				}));
			},
			[pageId, updatePage],
		);

		const setMatchMode = useCallback(
			(mode: MatchMode) => {
				updatePage(pageId, (current) => ({ ...current, matchMode: mode }));
			},
			[pageId, updatePage],
		);

		const setDateRange = useCallback(
			(range: DateRangeFilter | undefined) => {
				updatePage(pageId, (current) => ({
					...current,
					filters: { ...current.filters, dateRange: cloneDateRange(range) },
				}));
			},
			[pageId, updatePage],
		);

		const setDisplaySettings = useCallback(
			(settings: DisplaySettings) => {
				updatePage(pageId, (current) => ({
					...current,
					displaySettings: cloneDisplaySettings({
						grouping: settings.grouping,
						subGrouping: settings.subGrouping,
						ordering: {
							field: settings.ordering.field,
							direction: settings.ordering.field
								? settings.ordering.direction
								: "asc",
						},
					}),
				}));
			},
			[pageId, updatePage],
		);

		const replaceAll = useCallback(
			(next: {
				viewId: string | null;
				filters: TFilters;
				matchMode: MatchMode;
				displaySettings: DisplaySettings;
			}) => {
				updatePage(pageId, () => ({
					filters: config.cloneFilters(next.filters),
					matchMode: next.matchMode,
					displaySettings: cloneDisplaySettings({
						grouping: next.displaySettings.grouping,
						subGrouping: next.displaySettings.subGrouping,
						ordering: {
							field: next.displaySettings.ordering.field,
							direction: next.displaySettings.ordering.field
								? next.displaySettings.ordering.direction
								: "asc",
						},
					}),
					viewId: next.viewId,
				}));
			},
			[pageId, updatePage],
		);

		const setGrouping = useCallback(
			(grouping: string | null) => {
				updatePage(pageId, (current) => ({
					...current,
					displaySettings: {
						...current.displaySettings,
						grouping,
						subGrouping: null,
					},
				}));
			},
			[pageId, updatePage],
		);

		const setSubGrouping = useCallback(
			(subGrouping: string | null) => {
				updatePage(pageId, (current) => ({
					...current,
					displaySettings: { ...current.displaySettings, subGrouping },
				}));
			},
			[pageId, updatePage],
		);

		const setOrdering = useCallback(
			(field: string | null, direction: "asc" | "desc") => {
				updatePage(pageId, (current) => ({
					...current,
					displaySettings: {
						...current.displaySettings,
						ordering: { field, direction: field ? direction : "asc" },
					},
				}));
			},
			[pageId, updatePage],
		);

		const setView = useCallback(
			(viewId: string | null) => {
				updatePage(pageId, (current) => ({ ...current, viewId }));
			},
			[pageId, updatePage],
		);

		const clearFilters = useCallback(() => {
			setFiltersAndMatch(config.emptyFilters, "all");
		}, [setFiltersAndMatch]);

		const clearAll = useCallback(() => {
			resetPage(pageId);
		}, [pageId, resetPage]);

		return {
			filters: currentState.filters,
			matchMode: currentState.matchMode,
			displaySettings: currentState.displaySettings,
			viewId: currentState.viewId,
			isViewActive: currentState.viewId !== null,
			setArrayFilter,
			setFiltersAndMatch,
			setMatchMode,
			setDateRange,
			setDisplaySettings,
			replaceAll,
			setGrouping,
			setSubGrouping,
			setOrdering,
			setView,
			clearFilters,
			clearAll,
		};
	};
}
