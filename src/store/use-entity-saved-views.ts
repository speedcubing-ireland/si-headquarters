import { useMemo } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { DisplaySettingsState } from "./display-settings-factory";
import {
	type SavedView,
	type SavedViewEntity,
	useSavedViewsStore,
} from "./saved-views-store";
import type { BaseFilterStoreState } from "./shared-filter-factory";

interface UseEntitySavedViewsOptions<
	TFilters,
	TFilterType extends string,
	TValue,
> {
	entity: SavedViewEntity;
	filterStore: UseBoundStore<
		StoreApi<BaseFilterStoreState<TFilters, TFilterType, TValue>>
	>;
	displaySettingsStore: UseBoundStore<StoreApi<DisplaySettingsState>>;
}

export interface EntitySavedViewsHook {
	views: SavedView[];
	activeViewId: string | null;
	activeView: SavedView | null;
	setActiveView: (viewId: string | null) => void;
	createCurrentView: (name: string, description?: string) => string;
	applyView: (viewId: string) => void;
	deleteView: (viewId: string) => void;
}

export function useEntitySavedViews<
	TFilters,
	TFilterType extends string,
	TValue,
>({
	entity,
	filterStore,
	displaySettingsStore,
}: UseEntitySavedViewsOptions<
	TFilters,
	TFilterType,
	TValue
>): EntitySavedViewsHook {
	// Access state directly to avoid creating new references on each render
	const allViews = useSavedViewsStore((state) => state.views);
	const activeViewByEntity = useSavedViewsStore(
		(state) => state.activeViewByEntity,
	);
	const setActiveView = useSavedViewsStore((state) => state.setActiveView);
	const createView = useSavedViewsStore((state) => state.createView);
	const deleteViewStore = useSavedViewsStore((state) => state.deleteView);

	// Memoize filtered views to ensure stable reference
	const views = useMemo(
		() => allViews.filter((view) => view.entity === entity),
		[allViews, entity],
	);

	const activeViewId = activeViewByEntity[entity] || null;

	// Memoize active view to ensure stable reference
	const activeView = useMemo(() => {
		if (!activeViewId) return null;
		return views.find((view) => view.id === activeViewId) || null;
	}, [views, activeViewId]);

	const createCurrentView = (name: string, description?: string): string => {
		const filtersJson = filterStore.getState().toJSON();
		const displaySettingsJson = displaySettingsStore.getState().toJSON();
		return createView(
			entity,
			name,
			filtersJson,
			displaySettingsJson,
			description,
		);
	};

	const applyView = (viewId: string): void => {
		const view = views.find((v) => v.id === viewId);
		if (!view) return;

		filterStore.getState().fromJSON(view.filtersJson);
		displaySettingsStore.getState().fromJSON(view.displaySettingsJson);
		setActiveView(entity, viewId);
	};

	const deleteView = (viewId: string): void => {
		deleteViewStore(viewId);
		// If deleting the active view, clear filters and display settings
		if (viewId === activeViewId) {
			filterStore.getState().clearFilters();
			displaySettingsStore
				.getState()
				.fromJSON(displaySettingsStore.getState().toJSON());
			setActiveView(entity, null);
		}
	};

	return {
		views,
		activeViewId,
		activeView,
		setActiveView: (viewId) => setActiveView(entity, viewId),
		createCurrentView,
		applyView,
		deleteView,
	};
}
