import { useEffect, useCallback, useRef } from "react";
import {
	useNavigate,
	useSearch,
	stripSearchParams,
} from "@tanstack/react-router";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
	DateRangeFilter,
	FilterItem,
	MatchMode,
} from "@/store/shared-filter-types";
import type { DisplaySettingsState } from "@/store/display-settings-factory";
import type { SavedView } from "@/store/saved-views-store";
import {
	parseTasksFiltersFromSearch,
	parseCompetitionsFiltersFromSearch,
	parseDisplaySettingsFromSearch,
	serializeTasksFiltersToSearch,
	serializeCompetitionsFiltersToSearch,
	serializeDisplaySettingsToSearch,
	tasksSearchSchema,
	competitionsSearchSchema,
	type TasksSearchParams,
	type CompetitionsSearchParams,
} from "./route-search-params";

/**
 * Generic filter store shape (shared across tasks and competitions)
 */
type FilterStoreState<TFilters> = {
	filters: TFilters;
	matchMode: MatchMode;
	setFilter: (
		type: string,
		values: FilterItem<string>[] | DateRangeFilter | undefined,
	) => void;
	setMatchMode: (mode: MatchMode) => void;
	clearFilters: () => void;
	toJSON: () => string;
	fromJSON: (json: string) => void;
};

type FilterStore<TFilters> = UseBoundStore<
	StoreApi<FilterStoreState<TFilters>>
>;

type DisplayStore = UseBoundStore<StoreApi<DisplaySettingsState>>;

/**
 * Route default configuration
 */
export interface RouteDefaults<TFilters> {
	/** Filters that are mandatory for this route (e.g., My Tasks always filters by current user) */
	filters?: Partial<TFilters>;
	/** Display settings defaults */
	display?: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: { field: string | null; direction: "asc" | "desc" };
	};
	/** Whether users can customize filters beyond the defaults */
	customizable: boolean;
}

/**
 * Entity type for distinguishing tasks vs competitions
 */
export type EntityType = "tasks" | "competitions";

/**
 * Initialize route state from URL or saved view
 * This should be called in route beforeLoad
 */
export function initializeRouteState<TFilters>({
	entity,
	searchParams,
	routeDefaults,
	savedViews,
	currentUserId: _currentUserId,
}: {
	entity: EntityType;
	searchParams: TasksSearchParams | CompetitionsSearchParams;
	routeDefaults: RouteDefaults<TFilters>;
	savedViews: SavedView[];
	currentUserId?: string;
}): {
	filters: Partial<TFilters>;
	matchMode: MatchMode;
	display: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: { field: string | null; direction: "asc" | "desc" };
	};
	activeViewId: string | null;
} {
	// Check if a saved view is specified
	if (searchParams.view) {
		const view = savedViews.find((v) => v.id === searchParams.view);
		if (view) {
			// Parse the saved view filters and display settings
			let parsedFilters: Partial<TFilters> = {};
			let parsedDisplay = {
				grouping: null as string | null,
				subGrouping: null as string | null,
				ordering: {
					field: null as string | null,
					direction: "asc" as "asc" | "desc",
				},
			};
			let parsedMatchMode: MatchMode = "all";

			try {
				const filterData = JSON.parse(view.filtersJson);
				parsedFilters = filterData.filters || {};
				parsedMatchMode = filterData.matchMode || "all";
			} catch {
				// Invalid JSON, ignore
			}

			try {
				const displayData = JSON.parse(view.displaySettingsJson);
				parsedDisplay = {
					grouping: displayData.grouping || null,
					subGrouping: displayData.subGrouping || null,
					ordering: displayData.ordering || { field: null, direction: "asc" },
				};
			} catch {
				// Invalid JSON, ignore
			}

			// Apply route defaults on top of saved view (for non-customizable routes)
			if (!routeDefaults.customizable && routeDefaults.filters) {
				parsedFilters = { ...parsedFilters, ...routeDefaults.filters };
			}
			if (!routeDefaults.customizable && routeDefaults.display) {
				parsedDisplay = routeDefaults.display;
			}

			return {
				filters: parsedFilters,
				matchMode: parsedMatchMode,
				display: parsedDisplay,
				activeViewId: view.id,
			};
		}
		// View not found, fall through to defaults
	}

	// Parse filters from URL
	let urlFilters: Partial<TFilters> = {};
	if (entity === "tasks") {
		urlFilters = parseTasksFiltersFromSearch(
			searchParams as TasksSearchParams,
		) as unknown as Partial<TFilters>;
	} else if (entity === "competitions") {
		urlFilters = parseCompetitionsFiltersFromSearch(
			searchParams as CompetitionsSearchParams,
		) as unknown as Partial<TFilters>;
	}

	// Parse display settings from URL
	const urlDisplay = parseDisplaySettingsFromSearch(searchParams);

	// Combine defaults + URL params
	let finalFilters: Partial<TFilters> = {};
	let finalDisplay = urlDisplay;
	const finalMatchMode: MatchMode = (searchParams.match as MatchMode) || "all";

	if (routeDefaults.filters) {
		// For non-customizable routes, defaults override URL
		// For customizable routes, URL overrides defaults
		if (routeDefaults.customizable) {
			finalFilters = { ...routeDefaults.filters, ...urlFilters };
		} else {
			finalFilters = { ...urlFilters, ...routeDefaults.filters };
		}
	} else {
		finalFilters = urlFilters;
	}

	if (routeDefaults.display) {
		if (routeDefaults.customizable) {
			finalDisplay = {
				grouping: urlDisplay.grouping ?? routeDefaults.display.grouping,
				subGrouping:
					urlDisplay.subGrouping ?? routeDefaults.display.subGrouping,
				ordering: {
					field:
						urlDisplay.ordering.field ?? routeDefaults.display.ordering.field,
					direction:
						urlDisplay.ordering.direction ??
						routeDefaults.display.ordering.direction,
				},
			};
		} else {
			finalDisplay = routeDefaults.display;
		}
	}

	return {
		filters: finalFilters,
		matchMode: finalMatchMode,
		display: finalDisplay,
		activeViewId: null,
	};
}

/**
 * Serialize current filter/display state to URL params
 */
export function serializeStateToSearch<TFilters>({
	entity,
	filters,
	matchMode,
	display,
	activeViewId,
}: {
	entity: EntityType;
	filters: TFilters;
	matchMode: MatchMode;
	display: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: { field: string | null; direction: "asc" | "desc" };
	};
	activeViewId: string | null;
}): Record<string, string | string[]> {
	const params: Record<string, string | string[]> = {};

	// If active view, just include the view ID
	if (activeViewId) {
		params.view = activeViewId;
		return params;
	}

	// Serialize filters
	if (entity === "tasks") {
		const filterParams = serializeTasksFiltersToSearch(
			filters as {
				status: FilterItem<string>[];
				priority: FilterItem<string>[];
				assignee: FilterItem<string>[];
				labels: FilterItem<string>[];
				owner: FilterItem<string>[];
				parentType: FilterItem<string>[];
				dateRange?: DateRangeFilter;
			},
		);
		Object.assign(params, filterParams);
	} else if (entity === "competitions") {
		const filterParams = serializeCompetitionsFiltersToSearch(
			filters as {
				phase: FilterItem<string>[];
				compLead: FilterItem<string>[];
				leadDelegate: FilterItem<string>[];
				organisers: FilterItem<string>[];
				dateRange?: DateRangeFilter;
			},
		);
		Object.assign(params, filterParams);
	}

	// Add match mode if not default
	if (matchMode !== "all") {
		params.match = matchMode;
	}

	// Serialize display settings
	const displayParams = serializeDisplaySettingsToSearch(display);
	Object.assign(params, displayParams);

	return params;
}

/**
 * Hook for syncing filter/display state with URL
 */
export function useRouteStateSync<TFilters>({
	entity,
	filterStore,
	displayStore,
	activeViewId,
	debounceMs = 300,
}: {
	entity: EntityType;
	filterStore: FilterStore<TFilters>;
	displayStore: DisplayStore;
	activeViewId: string | null;
	debounceMs?: number;
}) {
	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as
		| TasksSearchParams
		| CompetitionsSearchParams;

	// Sync URL -> Store (on mount and when URL changes)
	useEffect(() => {
		const filterState = filterStore.getState();

		// Parse filters from URL
		let urlFilters: Partial<TFilters> = {};
		if (entity === "tasks") {
			urlFilters = parseTasksFiltersFromSearch(
				search as TasksSearchParams,
			) as unknown as Partial<TFilters>;
		} else if (entity === "competitions") {
			urlFilters = parseCompetitionsFiltersFromSearch(
				search as CompetitionsSearchParams,
			) as unknown as Partial<TFilters>;
		}

		const urlDisplay = parseDisplaySettingsFromSearch(search);
		const urlMatchMode = (search.match as MatchMode) || "all";

		// Apply to stores
		filterStore.setState({
			filters: { ...filterState.filters, ...urlFilters },
			matchMode: urlMatchMode,
		});

		displayStore.setState({
			grouping: urlDisplay.grouping,
			subGrouping: urlDisplay.subGrouping,
			ordering: urlDisplay.ordering,
		});
	}, [search, entity, filterStore, displayStore]);

	// Sync Store -> URL (with debounce)
	const syncToUrl = useCallback(() => {
		const filterState = filterStore.getState();
		const displayState = displayStore.getState();

		const searchParams = serializeStateToSearch({
			entity,
			filters: filterState.filters as TFilters,
			matchMode: filterState.matchMode,
			display: {
				grouping: displayState.grouping,
				subGrouping: displayState.subGrouping,
				ordering: displayState.ordering,
			},
			activeViewId,
		});

		// Update URL without navigation (replace)
		navigate({
			to: ".",
			search: searchParams,
			replace: true,
		});
	}, [navigate, entity, filterStore, displayStore, activeViewId]);

	// Subscribe to store changes and sync to URL
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;

		const unsubscribeFilter = filterStore.subscribe(() => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				syncToUrl();
			}, debounceMs);
		});

		const unsubscribeDisplay = displayStore.subscribe(() => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				syncToUrl();
			}, debounceMs);
		});

		return () => {
			clearTimeout(timeoutId);
			unsubscribeFilter();
			unsubscribeDisplay();
		};
	}, [filterStore, displayStore, syncToUrl, debounceMs]);

	return { syncToUrl };
}

/**
 * Build the full search schema for a route
 */
export function buildRouteSearchSchema(entity: EntityType) {
	return entity === "tasks" ? tasksSearchSchema : competitionsSearchSchema;
}

/**
 * Check if we're navigating to a detail route (for filter preservation)
 */
export function isDetailNavigation(fromPath: string, toPath: string): boolean {
	// Detail routes have a $id parameter
	const isFromList = !fromPath.includes("/$");
	const isToDetail = toPath.includes("/$");
	const isSameEntity =
		getEntityFromPath(fromPath) === getEntityFromPath(toPath);

	return isFromList && isToDetail && isSameEntity;
}

/**
 * Extract entity type from path
 */
function getEntityFromPath(path: string): EntityType | null {
	if (path.includes("/tasks")) return "tasks";
	if (path.includes("/competitions")) return "competitions";
	return null;
}

/**
 * Preserve filters for detail view navigation
 * Returns the parent route filters that should be restored on back
 */
export function preserveFiltersForDetail<TFilters>(
	filters: TFilters,
	matchMode: MatchMode,
	display: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: { field: string | null; direction: "asc" | "desc" };
	},
): string {
	return JSON.stringify({ filters, matchMode, display });
}

/**
 * Restore filters when returning from detail view
 */
export function restoreFiltersFromDetail<TFilters>(preserved: string): {
	filters: TFilters;
	matchMode: MatchMode;
	display: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: { field: string | null; direction: "asc" | "desc" };
	};
} | null {
	try {
		return JSON.parse(preserved);
	} catch {
		return null;
	}
}

// Re-export search schemas and stripSearchParams for convenience
export {
	stripSearchParams,
	tasksSearchSchema,
	competitionsSearchSchema,
	type TasksSearchParams,
	type CompetitionsSearchParams,
};

// Import types for the legacy API
import type { TasksFilters } from "@/store/tasks-filter-types";
import type { CompetitionsFilters } from "@/store/competitions-filter-types";
import type { BaseFilterStoreState } from "@/store/shared-filter-factory";
import type { TaskFilterType } from "@/store/tasks-filter-store";
import type { FilterType } from "@/store/competitions-filter-store";

// Type helpers for store types
type TasksFilterStore = UseBoundStore<
	StoreApi<BaseFilterStoreState<TasksFilters, TaskFilterType, string>>
>;
type CompetitionsFilterStore = UseBoundStore<
	StoreApi<BaseFilterStoreState<CompetitionsFilters, FilterType, string>>
>;

/**
 * Default empty search params for tasks
 * Used with stripSearchParams to clean URLs
 */
export const defaultTasksSearch: TasksSearchParams = {
	view: undefined,
	status: undefined,
	priority: undefined,
	assignee: undefined,
	labels: undefined,
	owner: undefined,
	parentType: undefined,
	dateStart: undefined,
	dateEnd: undefined,
	dateIsNot: "0",
	match: "all",
	grouping: undefined,
	subGrouping: undefined,
	orderField: undefined,
	orderDir: "asc",
};

/**
 * Default empty search params for competitions
 */
export const defaultCompetitionsSearch: CompetitionsSearchParams = {
	view: undefined,
	phase: undefined,
	compLead: undefined,
	leadDelegate: undefined,
	organisers: undefined,
	dateStart: undefined,
	dateEnd: undefined,
	dateIsNot: "0",
	match: "all",
	grouping: undefined,
	subGrouping: undefined,
	orderField: undefined,
	orderDir: "asc",
};

/**
 * Default search params for My Tasks (non-customizable route)
 * These are forced and stripped from URL
 */
export const myTasksDefaultSearch = (
	currentUserId: string,
): Partial<TasksSearchParams> => ({
	assignee: `${currentUserId}|0`, // Current user, not negated
	grouping: "status",
	match: "all",
});

/**
 * Hook to sync filter store with URL search params
 * This follows TanStack best practices:
 * - Initialize from URL on mount (not in beforeLoad)
 * - Sync store changes back to URL
 * - Respect saved views
 */
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
	const navigate = useNavigate();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const syncToUrl = () => {
			// Clear any pending sync
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			// Debounce the sync
			timeoutRef.current = setTimeout(() => {
				const filterState = filterStore.getState();
				const displayState = displayStore.getState();

				// If active view, just include the view ID
				if (activeViewId) {
					navigate({
						to: ".",
						search: { view: activeViewId },
						replace: true,
					});
					return;
				}

				// Serialize current state to URL params
				const params = {
					...serializeTasksFiltersToSearch(filterState.filters),
					...(filterState.matchMode !== "all" && {
						match: filterState.matchMode,
					}),
					...serializeDisplaySettingsToSearch(displayState),
				};

				// Update URL without navigation (replace)
				navigate({
					to: ".",
					search: params,
					replace: true,
				});
			}, 100); // Small debounce
		};

		// Subscribe to store changes
		const unsubscribeFilter = filterStore.subscribe(syncToUrl);
		const unsubscribeDisplay = displayStore.subscribe(syncToUrl);

		return () => {
			unsubscribeFilter();
			unsubscribeDisplay();
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [navigate, filterStore, displayStore, activeViewId]);
}

/**
 * Hook to sync competitions filter store with URL
 */
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
	const navigate = useNavigate();
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
					navigate({
						to: ".",
						search: { view: activeViewId },
						replace: true,
					});
					return;
				}

				const params = {
					...serializeCompetitionsFiltersToSearch(filterState.filters),
					...(filterState.matchMode !== "all" && {
						match: filterState.matchMode,
					}),
					...serializeDisplaySettingsToSearch(displayState),
				};

				navigate({
					to: ".",
					search: params,
					replace: true,
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
	}, [navigate, filterStore, displayStore, activeViewId]);
}

/**
 * Initialize tasks filter store from URL search params
 * Call this in useEffect on component mount
 */
export function initializeTasksStoreFromSearch(
	search: TasksSearchParams,
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
	// Check if a saved view is specified
	if (search.view) {
		const view = savedViews.views.find((v) => v.id === search.view);
		if (view) {
			try {
				const filterData = JSON.parse(view.filtersJson);
				const displayData = JSON.parse(view.displaySettingsJson);

				// Apply saved view, but override with forced defaults if provided
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
			} catch {
				// Invalid JSON, fall through to URL params
			}
		}
	}

	// Parse filters from URL
	const urlFilters = parseTasksFiltersFromSearch(search);
	const urlDisplay = parseDisplaySettingsFromSearch(search);

	// Apply forced defaults if provided (for non-customizable routes)
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
		matchMode: search.match || "all",
	});

	displayStore.setState({
		grouping: forcedDefaults?.grouping ?? urlDisplay.grouping,
		subGrouping: urlDisplay.subGrouping,
		ordering: urlDisplay.ordering,
	});

	savedViews.setActiveView(null);
	return null;
}

/**
 * Initialize competitions filter store from URL search params
 */
export function initializeCompetitionsStoreFromSearch(
	search: CompetitionsSearchParams,
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
	// Check if a saved view is specified
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
			} catch {
				// Invalid JSON, fall through to URL params
			}
		}
	}

	// Parse filters from URL
	const urlFilters = parseCompetitionsFiltersFromSearch(search);
	const urlDisplay = parseDisplaySettingsFromSearch(search);

	filterStore.setState({
		filters: {
			phase: (urlFilters.phase ?? []) as CompetitionsFilters["phase"],
			compLead: urlFilters.compLead ?? [],
			leadDelegate: urlFilters.leadDelegate ?? [],
			organisers: urlFilters.organisers ?? [],
			dateRange: urlFilters.dateRange,
		},
		matchMode: search.match || "all",
	});

	displayStore.setState({
		grouping: urlDisplay.grouping,
		subGrouping: urlDisplay.subGrouping,
		ordering: urlDisplay.ordering,
	});

	savedViews.setActiveView(null);
	return null;
}
