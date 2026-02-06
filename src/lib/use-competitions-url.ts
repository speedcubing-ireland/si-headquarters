"use client";

import { useCallback, useEffect, useMemo } from "react";
import type {
	CompetitionsFilters,
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/lib/filter-types";
import {
	type DisplaySettings,
	defaultDisplaySettings as DEFAULT_DISPLAY_SETTINGS,
} from "@/lib/saved-view-utils";
import { createListStateStore } from "@/store/create-list-state-store";

export interface CompetitionsUrlState {
	filters: CompetitionsFilters;
	matchMode: MatchMode;
	displaySettings: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: {
			field: string | null;
			direction: "asc" | "desc";
		};
	};
	viewId: string | null;
	isViewActive: boolean;
}

export interface CompetitionsUrlActions {
	setArrayFilter: <K extends Exclude<keyof CompetitionsFilters, "dateRange">>(
		key: K,
		value: CompetitionsFilters[K],
	) => void;
	setFiltersAndMatch: (
		filters: CompetitionsFilters,
		matchMode: MatchMode,
	) => void;
	setMatchMode: (mode: MatchMode) => void;
	setDateRange: (range: DateRangeFilter | undefined) => void;
	setDisplaySettings: (
		settings: CompetitionsUrlState["displaySettings"],
	) => void;
	replaceAll: (next: {
		viewId: string | null;
		filters: CompetitionsFilters;
		matchMode: MatchMode;
		displaySettings: CompetitionsUrlState["displaySettings"];
	}) => void;
	setGrouping: (grouping: string | null) => void;
	setSubGrouping: (subGrouping: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	setView: (viewId: string | null) => void;
	clearFilters: () => void;
	clearAll: () => void;
}

export type UseCompetitionsUrlOptions = {
	pageId?: string;
	defaultFilters?: Partial<CompetitionsFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
};

const useCompetitionsListStateStore = createListStateStore<CompetitionsFilters>(
	{
		cloneFilters: cloneCompetitionsFilters,
	},
);

const EMPTY_COMPETITIONS_FILTERS: CompetitionsFilters = {
	phase: [],
	compLead: [],
	leadDelegate: [],
	organisers: [],
	dateRange: undefined,
};

type ArrayFilterKey = Exclude<keyof CompetitionsFilters, "dateRange">;

function cloneFilterItem(item: FilterItem): FilterItem {
	return {
		values: [...item.values],
		isNot: item.isNot,
	};
}

function cloneFilterItems(items: FilterItem[]): FilterItem[] {
	return items.map(cloneFilterItem);
}

function cloneDateRange(
	dateRange: DateRangeFilter | undefined,
): DateRangeFilter | undefined {
	if (!dateRange) return undefined;
	return {
		start: dateRange.start,
		end: dateRange.end,
		isNot: dateRange.isNot,
	};
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

function cloneCompetitionsFilters(
	filters: CompetitionsFilters,
): CompetitionsFilters {
	return {
		phase: cloneFilterItems(filters.phase),
		compLead: cloneFilterItems(filters.compLead),
		leadDelegate: cloneFilterItems(filters.leadDelegate),
		organisers: cloneFilterItems(filters.organisers),
		dateRange: cloneDateRange(filters.dateRange),
	};
}

function buildDefaultFilters(
	defaultFilters: Partial<CompetitionsFilters> | undefined,
): CompetitionsFilters {
	return cloneCompetitionsFilters({
		phase: defaultFilters?.phase ?? EMPTY_COMPETITIONS_FILTERS.phase,
		compLead: defaultFilters?.compLead ?? EMPTY_COMPETITIONS_FILTERS.compLead,
		leadDelegate:
			defaultFilters?.leadDelegate ?? EMPTY_COMPETITIONS_FILTERS.leadDelegate,
		organisers:
			defaultFilters?.organisers ?? EMPTY_COMPETITIONS_FILTERS.organisers,
		dateRange: defaultFilters?.dateRange,
	});
}

function buildDefaultDisplaySettings(
	defaultDisplaySettings: Partial<DisplaySettings> | undefined,
): DisplaySettings {
	const ordering = defaultDisplaySettings?.ordering;
	return {
		grouping:
			defaultDisplaySettings?.grouping ?? DEFAULT_DISPLAY_SETTINGS.grouping,
		subGrouping:
			defaultDisplaySettings?.subGrouping ??
			DEFAULT_DISPLAY_SETTINGS.subGrouping,
		ordering: {
			field: ordering?.field ?? DEFAULT_DISPLAY_SETTINGS.ordering.field,
			direction:
				ordering?.direction === "desc"
					? "desc"
					: DEFAULT_DISPLAY_SETTINGS.ordering.direction,
		},
	};
}

function setArrayFilterValue(
	filters: CompetitionsFilters,
	key: ArrayFilterKey,
	value: CompetitionsFilters[ArrayFilterKey],
): CompetitionsFilters {
	const nextValue = cloneFilterItems(value);

	switch (key) {
		case "phase":
			return { ...filters, phase: nextValue };
		case "compLead":
			return { ...filters, compLead: nextValue };
		case "leadDelegate":
			return { ...filters, leadDelegate: nextValue };
		case "organisers":
			return { ...filters, organisers: nextValue };
	}
}

export function useCompetitionsUrl({
	pageId = "all",
	defaultFilters,
	defaultDisplaySettings,
}: UseCompetitionsUrlOptions = {}): CompetitionsUrlState &
	CompetitionsUrlActions {
	const ensurePage = useCompetitionsListStateStore((state) => state.ensurePage);
	const updatePage = useCompetitionsListStateStore((state) => state.updatePage);
	const resetPage = useCompetitionsListStateStore((state) => state.resetPage);
	const pageState = useCompetitionsListStateStore(
		(state) => state.pages[pageId],
	);

	const baseFilters = useMemo(
		() => buildDefaultFilters(defaultFilters),
		[defaultFilters],
	);
	const baseDisplaySettings = useMemo(
		() => buildDefaultDisplaySettings(defaultDisplaySettings),
		[defaultDisplaySettings],
	);

	useEffect(() => {
		ensurePage(pageId, {
			baseFilters,
			baseDisplaySettings,
		});
	}, [ensurePage, pageId, baseFilters, baseDisplaySettings]);

	const fallbackState = useMemo<{
		filters: CompetitionsFilters;
		matchMode: MatchMode;
		displaySettings: DisplaySettings;
		viewId: null;
	}>(
		() => ({
			filters: cloneCompetitionsFilters(baseFilters),
			matchMode: "all",
			displaySettings: cloneDisplaySettings(baseDisplaySettings),
			viewId: null,
		}),
		[baseFilters, baseDisplaySettings],
	);

	const currentState = pageState ?? fallbackState;

	const setArrayFilter: CompetitionsUrlActions["setArrayFilter"] = useCallback(
		(key, value) => {
			updatePage(pageId, (current) => ({
				...current,
				filters: setArrayFilterValue(current.filters, key, value),
			}));
		},
		[pageId, updatePage],
	);

	const setFiltersAndMatch = useCallback(
		(filters: CompetitionsFilters, matchMode: MatchMode) => {
			updatePage(pageId, (current) => ({
				...current,
				filters: cloneCompetitionsFilters(filters),
				matchMode,
			}));
		},
		[pageId, updatePage],
	);

	const setMatchMode = useCallback(
		(mode: MatchMode) => {
			updatePage(pageId, (current) => ({
				...current,
				matchMode: mode,
			}));
		},
		[pageId, updatePage],
	);

	const setDateRange = useCallback(
		(range: DateRangeFilter | undefined) => {
			updatePage(pageId, (current) => ({
				...current,
				filters: {
					...current.filters,
					dateRange: cloneDateRange(range),
				},
			}));
		},
		[pageId, updatePage],
	);

	const setDisplaySettings = useCallback(
		(settings: CompetitionsUrlState["displaySettings"]) => {
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
			filters: CompetitionsFilters;
			matchMode: MatchMode;
			displaySettings: CompetitionsUrlState["displaySettings"];
		}) => {
			updatePage(pageId, () => ({
				filters: cloneCompetitionsFilters(next.filters),
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
				displaySettings: {
					...current.displaySettings,
					subGrouping,
				},
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
					ordering: {
						field,
						direction: field ? direction : "asc",
					},
				},
			}));
		},
		[pageId, updatePage],
	);

	const setView = useCallback(
		(viewId: string | null) => {
			updatePage(pageId, (current) => ({
				...current,
				viewId,
			}));
		},
		[pageId, updatePage],
	);

	const clearFilters = useCallback(() => {
		setFiltersAndMatch(EMPTY_COMPETITIONS_FILTERS, "all");
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
}
