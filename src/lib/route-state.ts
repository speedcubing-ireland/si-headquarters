import { useEffect, useRef } from "react";
import { useQueryStates } from "nuqs";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
	FilterItem,
	MatchMode,
	DateRangeFilter,
} from "@/store/shared-filter-types";
import type { DisplaySettingsState } from "@/store/display-settings-factory";
import {
	tasksFilterParsers,
	competitionsFilterParsers,
	parseDateRangeFromNuqs,
	serializeDateRangeToNuqs,
} from "./nuqs-parsers";
import { serializeDisplaySettingsToSearch } from "./route-search-params";

type DisplayStore = UseBoundStore<StoreApi<DisplaySettingsState>>;

import type { TasksFilters } from "@/store/tasks-filter-types";
import type { CompetitionsFilters } from "@/store/competitions-filter-types";
import type { BaseFilterStoreState } from "@/store/shared-filter-factory";
import type { TaskFilterType } from "@/store/tasks-filter-store";
import type { FilterType } from "@/store/competitions-filter-store";

type TasksFilterStore = UseBoundStore<
	StoreApi<BaseFilterStoreState<TasksFilters, TaskFilterType, string>>
>;
type CompetitionsFilterStore = UseBoundStore<
	StoreApi<BaseFilterStoreState<CompetitionsFilters, FilterType, string>>
>;

export function useSyncTasksFiltersToUrl({
	filterStore,
	displayStore,
	savedViews: _savedViews,
	activeViewId,
}: {
	filterStore: TasksFilterStore;
	displayStore: DisplayStore;
	savedViews: {
		views: Array<{
			id: string;
			filtersJson: string;
			displaySettingsJson: string;
		}>;
	};
	activeViewId: string | null;
}) {
	const [urlState, setUrlState] = useQueryStates(tasksFilterParsers, {
		history: "replace",
		shallow: false,
	});

	useEffect(() => {
		if (activeViewId) return;

		const filterState = filterStore.getState();

		const urlFilters: Partial<{
			status: FilterItem<string>[];
			priority: FilterItem<string>[];
			assignee: FilterItem<string>[];
			labels: FilterItem<string>[];
			owner: FilterItem<string>[];
			parentType: FilterItem<string>[];
			dateRange?: DateRangeFilter;
		}> = {};

		if (urlState.status) urlFilters.status = urlState.status;
		if (urlState.priority) urlFilters.priority = urlState.priority;
		if (urlState.assignee) urlFilters.assignee = urlState.assignee;
		if (urlState.labels) urlFilters.labels = urlState.labels;
		if (urlState.owner) urlFilters.owner = urlState.owner;
		if (urlState.parentType) urlFilters.parentType = urlState.parentType;

		const dateRange = parseDateRangeFromNuqs({
			dateStart: urlState.dateStart,
			dateEnd: urlState.dateEnd,
			dateIsNot: urlState.dateIsNot,
		});
		if (dateRange) urlFilters.dateRange = dateRange;

		const urlDisplay = {
			grouping: urlState.grouping ?? null,
			subGrouping: urlState.subGrouping ?? null,
			ordering: {
				field: urlState.orderField ?? null,
				direction: urlState.orderDir ?? "asc",
			},
		};

		const urlMatchMode = urlState.match ?? "all";

		filterStore.setState({
			filters: {
				...filterState.filters,
				...urlFilters,
			} as typeof filterState.filters,
			matchMode: urlMatchMode,
		});

		displayStore.setState({
			grouping: urlDisplay.grouping,
			subGrouping: urlDisplay.subGrouping,
			ordering: urlDisplay.ordering,
		});
	}, [urlState, activeViewId, filterStore, displayStore]);

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const syncToUrl = () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				const filterState = filterStore.getState();
				const displayState = displayStore.getState();

				if (activeViewId) {
					setUrlState({ view: activeViewId });
					return;
				}

				const displayParams = serializeDisplaySettingsToSearch(displayState);

				const dateRangeParams = serializeDateRangeToNuqs(
					filterState.filters.dateRange,
				);

				setUrlState({
					view: null,
					status:
						filterState.filters.status.length > 0
							? (filterState.filters.status as FilterItem<string>[])
							: null,
					priority:
						filterState.filters.priority.length > 0
							? (filterState.filters.priority as FilterItem<string>[])
							: null,
					assignee:
						filterState.filters.assignee.length > 0
							? (filterState.filters.assignee as FilterItem<string>[])
							: null,
					labels:
						filterState.filters.labels.length > 0
							? (filterState.filters.labels as FilterItem<string>[])
							: null,
					owner:
						filterState.filters.owner.length > 0
							? (filterState.filters.owner as FilterItem<string>[])
							: null,
					parentType:
						filterState.filters.parentType.length > 0
							? (filterState.filters.parentType as FilterItem<string>[])
							: null,
					dateStart: dateRangeParams.dateStart,
					dateEnd: dateRangeParams.dateEnd,
					dateIsNot: (dateRangeParams.dateIsNot as "0" | "1" | null) ?? null,
					match: filterState.matchMode !== "all" ? filterState.matchMode : null,
					grouping: displayParams.grouping ?? null,
					subGrouping: displayParams.subGrouping ?? null,
					orderField: displayParams.orderField ?? null,
					orderDir:
						(displayParams.orderDir as "asc" | "desc" | undefined) ?? null,
				});
			}, 100);
		};

		const unsubscribeFilter = filterStore.subscribe(syncToUrl);
		const unsubscribeDisplay = displayStore.subscribe(syncToUrl);

		return () => {
			unsubscribeFilter();
			unsubscribeDisplay();
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [filterStore, displayStore, activeViewId, setUrlState]);
}

export function useSyncCompetitionsFiltersToUrl({
	filterStore,
	displayStore,
	savedViews: _savedViews,
	activeViewId,
}: {
	filterStore: CompetitionsFilterStore;
	displayStore: DisplayStore;
	savedViews: {
		views: Array<{
			id: string;
			filtersJson: string;
			displaySettingsJson: string;
		}>;
	};
	activeViewId: string | null;
}) {
	const [urlState, setUrlState] = useQueryStates(competitionsFilterParsers, {
		history: "replace",
		shallow: false,
	});

	useEffect(() => {
		if (activeViewId) return;

		const filterState = filterStore.getState();

		const urlFilters: Partial<{
			phase: FilterItem<string>[];
			compLead: FilterItem<string>[];
			leadDelegate: FilterItem<string>[];
			organisers: FilterItem<string>[];
			dateRange?: DateRangeFilter;
		}> = {};

		if (urlState.phase) urlFilters.phase = urlState.phase;
		if (urlState.compLead) urlFilters.compLead = urlState.compLead;
		if (urlState.leadDelegate) urlFilters.leadDelegate = urlState.leadDelegate;
		if (urlState.organisers) urlFilters.organisers = urlState.organisers;

		const dateRange = parseDateRangeFromNuqs({
			dateStart: urlState.dateStart,
			dateEnd: urlState.dateEnd,
			dateIsNot: urlState.dateIsNot,
		});
		if (dateRange) urlFilters.dateRange = dateRange;

		const urlDisplay = {
			grouping: urlState.grouping ?? null,
			subGrouping: urlState.subGrouping ?? null,
			ordering: {
				field: urlState.orderField ?? null,
				direction: urlState.orderDir ?? "asc",
			},
		};

		const urlMatchMode = urlState.match ?? "all";

		filterStore.setState({
			filters: {
				...filterState.filters,
				...urlFilters,
			} as typeof filterState.filters,
			matchMode: urlMatchMode,
		});

		displayStore.setState({
			grouping: urlDisplay.grouping,
			subGrouping: urlDisplay.subGrouping,
			ordering: urlDisplay.ordering,
		});
	}, [urlState, activeViewId, filterStore, displayStore]);

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const syncToUrl = () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				const filterState = filterStore.getState();
				const displayState = displayStore.getState();

				if (activeViewId) {
					setUrlState({ view: activeViewId });
					return;
				}

				const displayParams = serializeDisplaySettingsToSearch(displayState);

				const dateRangeParams = serializeDateRangeToNuqs(
					filterState.filters.dateRange,
				);

				setUrlState({
					view: null,
					phase:
						filterState.filters.phase.length > 0
							? (filterState.filters.phase as FilterItem<string>[])
							: null,
					compLead:
						filterState.filters.compLead.length > 0
							? (filterState.filters.compLead as FilterItem<string>[])
							: null,
					leadDelegate:
						filterState.filters.leadDelegate.length > 0
							? (filterState.filters.leadDelegate as FilterItem<string>[])
							: null,
					organisers:
						filterState.filters.organisers.length > 0
							? (filterState.filters.organisers as FilterItem<string>[])
							: null,
					dateStart: dateRangeParams.dateStart,
					dateEnd: dateRangeParams.dateEnd,
					dateIsNot: (dateRangeParams.dateIsNot as "0" | "1" | null) ?? null,
					match: filterState.matchMode !== "all" ? filterState.matchMode : null,
					grouping: displayParams.grouping ?? null,
					subGrouping: displayParams.subGrouping ?? null,
					orderField: displayParams.orderField ?? null,
					orderDir:
						(displayParams.orderDir as "asc" | "desc" | undefined) ?? null,
				});
			}, 100);
		};

		const unsubscribeFilter = filterStore.subscribe(syncToUrl);
		const unsubscribeDisplay = displayStore.subscribe(syncToUrl);

		return () => {
			unsubscribeFilter();
			unsubscribeDisplay();
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [filterStore, displayStore, activeViewId, setUrlState]);
}

export function initializeTasksStoreFromSearch(
	search: {
		view: string | null;
		status: FilterItem<string>[] | null;
		priority: FilterItem<string>[] | null;
		assignee: FilterItem<string>[] | null;
		labels: FilterItem<string>[] | null;
		owner: FilterItem<string>[] | null;
		parentType: FilterItem<string>[] | null;
		dateStart: string | null;
		dateEnd: string | null;
		dateIsNot: string | null;
		match: MatchMode | null;
		grouping: string | null;
		subGrouping: string | null;
		orderField: string | null;
		orderDir: "asc" | "desc" | null;
	},
	filterStore: TasksFilterStore,
	displayStore: DisplayStore,
	savedViews: {
		views: Array<{
			id: string;
			filtersJson: string;
			displaySettingsJson: string;
		}>;
		setActiveView: (id: string | null) => void;
	},
	forcedDefaults?: { assignee?: string[]; grouping?: string },
): string | null {
	if (search.view) {
		const view = savedViews.views.find((v) => v.id === search.view);
		if (view) {
			try {
				const filterData = JSON.parse(view.filtersJson);
				const displayData = JSON.parse(view.displaySettingsJson);

				filterStore.setState({
					filters: {
						...filterData.filters,
						...(forcedDefaults?.assignee && {
							assignee: forcedDefaults.assignee.map((id) => ({
								values: [id],
								isNot: false,
							})),
						}),
					},
					matchMode: filterData.matchMode || "all",
				});

				displayStore.setState({
					grouping: forcedDefaults?.grouping ?? displayData.grouping ?? null,
					subGrouping: displayData.subGrouping ?? null,
					ordering: displayData.ordering ?? { field: null, direction: "asc" },
				});

				savedViews.setActiveView(view.id);
				return view.id;
			} catch {}
		}
	}

	const urlFilters = {
		status: search.status ?? undefined,
		priority: search.priority ?? undefined,
		assignee: search.assignee ?? undefined,
		labels: search.labels ?? undefined,
		owner: search.owner ?? undefined,
		parentType: search.parentType ?? undefined,
		dateRange: parseDateRangeFromNuqs({
			dateStart: search.dateStart,
			dateEnd: search.dateEnd,
			dateIsNot: search.dateIsNot,
		}),
	};

	const urlDisplay = {
		grouping: search.grouping ?? null,
		subGrouping: search.subGrouping ?? null,
		ordering: {
			field: search.orderField ?? null,
			direction: search.orderDir ?? "asc",
		},
	};

	const finalFilters: TasksFilters = {
		status: (urlFilters.status ?? []) as TasksFilters["status"],
		priority: (urlFilters.priority ?? []) as TasksFilters["priority"],
		assignee: forcedDefaults?.assignee
			? forcedDefaults.assignee.map((id) => ({ values: [id], isNot: false }))
			: (urlFilters.assignee ?? []),
		labels: urlFilters.labels ?? [],
		owner: urlFilters.owner ?? [],
		parentType: (urlFilters.parentType ?? []) as TasksFilters["parentType"],
		dateRange: urlFilters.dateRange,
	};

	filterStore.setState({
		filters: finalFilters,
		matchMode: search.match ?? "all",
	});

	displayStore.setState({
		grouping: forcedDefaults?.grouping ?? urlDisplay.grouping,
		subGrouping: urlDisplay.subGrouping,
		ordering: urlDisplay.ordering,
	});

	savedViews.setActiveView(null);
	return null;
}

export function initializeCompetitionsStoreFromSearch(
	search: {
		view: string | null;
		phase: FilterItem<string>[] | null;
		compLead: FilterItem<string>[] | null;
		leadDelegate: FilterItem<string>[] | null;
		organisers: FilterItem<string>[] | null;
		dateStart: string | null;
		dateEnd: string | null;
		dateIsNot: string | null;
		match: MatchMode | null;
		grouping: string | null;
		subGrouping: string | null;
		orderField: string | null;
		orderDir: "asc" | "desc" | null;
	},
	filterStore: CompetitionsFilterStore,
	displayStore: DisplayStore,
	savedViews: {
		views: Array<{
			id: string;
			filtersJson: string;
			displaySettingsJson: string;
		}>;
		setActiveView: (id: string | null) => void;
	},
): string | null {
	if (search.view) {
		const view = savedViews.views.find((v) => v.id === search.view);
		if (view) {
			try {
				const filterData = JSON.parse(view.filtersJson);
				const displayData = JSON.parse(view.displaySettingsJson);

				filterStore.setState({
					filters: filterData.filters || {},
					matchMode: filterData.matchMode || "all",
				});

				displayStore.setState({
					grouping: displayData.grouping ?? null,
					subGrouping: displayData.subGrouping ?? null,
					ordering: displayData.ordering ?? { field: null, direction: "asc" },
				});

				savedViews.setActiveView(view.id);
				return view.id;
			} catch {}
		}
	}

	const urlFilters = {
		phase: search.phase ?? undefined,
		compLead: search.compLead ?? undefined,
		leadDelegate: search.leadDelegate ?? undefined,
		organisers: search.organisers ?? undefined,
		dateRange: parseDateRangeFromNuqs({
			dateStart: search.dateStart,
			dateEnd: search.dateEnd,
			dateIsNot: search.dateIsNot,
		}),
	};

	const urlDisplay = {
		grouping: search.grouping ?? null,
		subGrouping: search.subGrouping ?? null,
		ordering: {
			field: search.orderField ?? null,
			direction: search.orderDir ?? "asc",
		},
	};

	filterStore.setState({
		filters: {
			phase: (urlFilters.phase ?? []) as CompetitionsFilters["phase"],
			compLead: urlFilters.compLead ?? [],
			leadDelegate: urlFilters.leadDelegate ?? [],
			organisers: urlFilters.organisers ?? [],
			dateRange: urlFilters.dateRange,
		},
		matchMode: search.match ?? "all",
	});

	displayStore.setState({
		grouping: urlDisplay.grouping,
		subGrouping: urlDisplay.subGrouping,
		ordering: urlDisplay.ordering,
	});

	savedViews.setActiveView(null);
	return null;
}
