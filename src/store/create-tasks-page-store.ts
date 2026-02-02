import { useMemo } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import {
	createFilterStore,
	type BaseFilterStoreState,
} from "./shared-filter-factory";
import {
	createDisplaySettingsStore,
	type DisplaySettingsState,
} from "./display-settings-factory";
import {
	useEntitySavedViews,
	type EntitySavedViewsHook,
} from "./use-entity-saved-views";
import type { TasksFilters } from "./tasks-filter-types";
import type { TaskPriority, TaskStatus } from "@/data/types-new";
import { emptyTasksFilters } from "./tasks-filter-types";
import { getActiveFiltersCount, hasActiveFilters } from "@/lib/task-filters";
import type { TaskFilterType } from "./tasks-filter-store";

// Store instances cache - keyed by pageId
type StoreCacheEntry = {
	useFilters: UseBoundStore<
		StoreApi<
			BaseFilterStoreState<
				TasksFilters,
				TaskFilterType,
				TaskStatus | TaskPriority | string
			>
		>
	>;
	useDisplay: UseBoundStore<StoreApi<DisplaySettingsState>>;
};

const storeCache = new Map<string, StoreCacheEntry>();

export type TasksPageConfig = {
	pageId: string;
	defaultFilters?: Partial<TasksFilters>;
	defaultDisplaySettings?: {
		grouping?: string | null;
		subGrouping?: string | null;
		ordering?: { field: string | null; direction: "asc" | "desc" };
	};
};

export type TasksPageStores = {
	useFilters: UseBoundStore<
		StoreApi<
			BaseFilterStoreState<
				TasksFilters,
				TaskFilterType,
				TaskStatus | TaskPriority | string
			>
		>
	>;
	useDisplay: UseBoundStore<StoreApi<DisplaySettingsState>>;
	useSavedViews: EntitySavedViewsHook;
};

function getOrCreateStores(config: TasksPageConfig): StoreCacheEntry {
	const { pageId, defaultFilters, defaultDisplaySettings } = config;

	// Check if stores already exist for this page
	let stores = storeCache.get(pageId);

	if (!stores) {
		// Create filter store with merged defaults
		const initialFilters: TasksFilters = {
			...emptyTasksFilters,
			...defaultFilters,
		};

		const filterStore = createFilterStore<
			TaskFilterType,
			TaskStatus | TaskPriority | string,
			TasksFilters
		>({
			initialFilters,
			dateFilterType: "date",
			toggleFilterTypes: [
				"status",
				"priority",
				"assignee",
				"labels",
				"owner",
				"parentType",
			],
			hasActiveFilters,
			getActiveFiltersCount,
		});

		// Create display settings store with defaults
		const displayStore = createDisplaySettingsStore();

		// Apply default display settings if provided
		if (defaultDisplaySettings) {
			const defaultJson = JSON.stringify({
				grouping: defaultDisplaySettings.grouping ?? null,
				subGrouping: defaultDisplaySettings.subGrouping ?? null,
				ordering: defaultDisplaySettings.ordering ?? {
					field: null,
					direction: "asc",
				},
			});
			displayStore.getState().fromJSON(defaultJson);
		}

		stores = {
			useFilters: filterStore,
			useDisplay: displayStore,
		};

		storeCache.set(pageId, stores);
	}

	// Note: useSavedViews will be added at the hook level since it's a React hook
	return stores as StoreCacheEntry;
}

/**
 * Hook to get or create per-page stores for tasks
 * Each page gets its own isolated filter, display, and saved views stores
 *
 * @param pageId - Unique identifier for the page (e.g., "all", "my", "team-123")
 * @param config - Optional configuration for default filters and display settings
 * @returns Object containing the stores for this page
 */
export function useTasksPageStore(
	pageId: string,
	config?: Omit<TasksPageConfig, "pageId">,
): TasksPageStores {
	const fullConfig: TasksPageConfig = {
		pageId,
		...config,
	};

	// Get or create the stores (these are stable references)
	const stores = useMemo(() => getOrCreateStores(fullConfig), [pageId]);

	// Create saved views hook - this is a React hook so we call it at top level
	const savedViews = useEntitySavedViews<
		TasksFilters,
		TaskFilterType,
		TaskStatus | TaskPriority | string
	>({
		entity: "tasks",
		filterStore: stores.useFilters,
		displaySettingsStore: stores.useDisplay,
	});

	return {
		useFilters: stores.useFilters,
		useDisplay: stores.useDisplay,
		useSavedViews: savedViews,
	};
}

/**
 * Clear the store cache for a specific page
 * Useful for testing or when you want to force a fresh store
 */
export function clearTasksPageStore(pageId: string): void {
	storeCache.delete(pageId);
}

/**
 * Clear all cached stores
 */
export function clearAllTasksPageStores(): void {
	storeCache.clear();
}
