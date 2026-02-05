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

	let stores = storeCache.get(pageId);

	if (!stores) {
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

		const displayStore = createDisplaySettingsStore();

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

	return stores as StoreCacheEntry;
}

export function useTasksPageStore(
	pageId: string,
	config?: Omit<TasksPageConfig, "pageId">,
): TasksPageStores {
	const fullConfig: TasksPageConfig = {
		pageId,
		...config,
	};
	const stores = useMemo(() => getOrCreateStores(fullConfig), [pageId]);
	const savedViews = useEntitySavedViews<
		TasksFilters,
		TaskFilterType,
		TaskStatus | TaskPriority | string
	>({
		entity: "tasks",
		pageId,
		filterStore: stores.useFilters,
		displaySettingsStore: stores.useDisplay,
	});

	return {
		useFilters: stores.useFilters,
		useDisplay: stores.useDisplay,
		useSavedViews: savedViews,
	};
}
