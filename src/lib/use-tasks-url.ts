"use client";

import { useCallback, useEffect, useMemo } from "react";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
	TasksFilters,
} from "@/lib/filter-types";
import {
	type DisplaySettings,
	defaultDisplaySettings as DEFAULT_DISPLAY_SETTINGS,
} from "@/lib/saved-view-utils";
import { createListStateStore } from "@/store/create-list-state-store";

export interface TasksUrlState {
	filters: TasksFilters;
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

export interface TasksUrlActions {
	setArrayFilter: <K extends Exclude<keyof TasksFilters, "dateRange">>(
		key: K,
		value: TasksFilters[K],
	) => void;
	setFiltersAndMatch: (filters: TasksFilters, matchMode: MatchMode) => void;
	setMatchMode: (mode: MatchMode) => void;
	setDateRange: (range: DateRangeFilter | undefined) => void;
	setDisplaySettings: (settings: TasksUrlState["displaySettings"]) => void;
	replaceAll: (next: {
		viewId: string | null;
		filters: TasksFilters;
		matchMode: MatchMode;
		displaySettings: TasksUrlState["displaySettings"];
	}) => void;
	setGrouping: (grouping: string | null) => void;
	setSubGrouping: (subGrouping: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	setView: (viewId: string | null) => void;
	clearFilters: () => void;
	clearAll: () => void;
}

export type UseTasksUrlOptions = {
	pageId: string;
	defaultFilters?: Partial<TasksFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
};

const useTasksListStateStore = createListStateStore<TasksFilters>({
	cloneFilters: cloneTasksFilters,
});

const EMPTY_TASKS_FILTERS: TasksFilters = {
	status: [],
	priority: [],
	assignee: [],
	labels: [],
	owner: [],
	parentType: [],
	dateRange: undefined,
};

type ArrayFilterKey = Exclude<keyof TasksFilters, "dateRange">;

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

function cloneTasksFilters(filters: TasksFilters): TasksFilters {
	return {
		status: cloneFilterItems(filters.status),
		priority: cloneFilterItems(filters.priority),
		assignee: cloneFilterItems(filters.assignee),
		labels: cloneFilterItems(filters.labels),
		owner: cloneFilterItems(filters.owner),
		parentType: cloneFilterItems(filters.parentType),
		dateRange: cloneDateRange(filters.dateRange),
	};
}

function buildDefaultFilters(
	defaultFilters: Partial<TasksFilters> | undefined,
): TasksFilters {
	return cloneTasksFilters({
		status: defaultFilters?.status ?? EMPTY_TASKS_FILTERS.status,
		priority: defaultFilters?.priority ?? EMPTY_TASKS_FILTERS.priority,
		assignee: defaultFilters?.assignee ?? EMPTY_TASKS_FILTERS.assignee,
		labels: defaultFilters?.labels ?? EMPTY_TASKS_FILTERS.labels,
		owner: defaultFilters?.owner ?? EMPTY_TASKS_FILTERS.owner,
		parentType: defaultFilters?.parentType ?? EMPTY_TASKS_FILTERS.parentType,
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
	filters: TasksFilters,
	key: ArrayFilterKey,
	value: TasksFilters[ArrayFilterKey],
): TasksFilters {
	const nextValue = cloneFilterItems(value);

	switch (key) {
		case "status":
			return { ...filters, status: nextValue };
		case "priority":
			return { ...filters, priority: nextValue };
		case "assignee":
			return { ...filters, assignee: nextValue };
		case "labels":
			return { ...filters, labels: nextValue };
		case "owner":
			return { ...filters, owner: nextValue };
		case "parentType":
			return { ...filters, parentType: nextValue };
	}
}

export function useTasksUrl({
	pageId,
	defaultFilters,
	defaultDisplaySettings,
}: UseTasksUrlOptions): TasksUrlState & TasksUrlActions {
	const ensurePage = useTasksListStateStore((state) => state.ensurePage);
	const updatePage = useTasksListStateStore((state) => state.updatePage);
	const resetPage = useTasksListStateStore((state) => state.resetPage);
	const pageState = useTasksListStateStore((state) => state.pages[pageId]);

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
		filters: TasksFilters;
		matchMode: MatchMode;
		displaySettings: DisplaySettings;
		viewId: null;
	}>(
		() => ({
			filters: cloneTasksFilters(baseFilters),
			matchMode: "all",
			displaySettings: cloneDisplaySettings(baseDisplaySettings),
			viewId: null,
		}),
		[baseFilters, baseDisplaySettings],
	);

	const currentState = pageState ?? fallbackState;

	const setArrayFilter: TasksUrlActions["setArrayFilter"] = useCallback(
		(key, value) => {
			updatePage(pageId, (current) => ({
				...current,
				filters: setArrayFilterValue(current.filters, key, value),
			}));
		},
		[pageId, updatePage],
	);

	const setFiltersAndMatch = useCallback(
		(filters: TasksFilters, matchMode: MatchMode) => {
			updatePage(pageId, (current) => ({
				...current,
				filters: cloneTasksFilters(filters),
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
		(settings: TasksUrlState["displaySettings"]) => {
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
			filters: TasksFilters;
			matchMode: MatchMode;
			displaySettings: TasksUrlState["displaySettings"];
		}) => {
			updatePage(pageId, () => ({
				filters: cloneTasksFilters(next.filters),
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
		setFiltersAndMatch(EMPTY_TASKS_FILTERS, "all");
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
