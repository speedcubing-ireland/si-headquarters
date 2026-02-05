import { useMemo } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DisplaySettingsState } from "./display-settings-factory";
import type { SavedView, SavedViewEntity } from "./saved-views-store";
import type { BaseFilterStoreState } from "./shared-filter-factory";

interface UseEntitySavedViewsOptions<
	TFilters,
	TFilterType extends string,
	TValue,
> {
	entity: SavedViewEntity;
	pageId: string;
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
	pageId,
	filterStore,
	displaySettingsStore,
}: UseEntitySavedViewsOptions<
	TFilters,
	TFilterType,
	TValue
>): EntitySavedViewsHook {
	const listResult = useQuery(api.views.listViews, {
		entity,
		pageId,
	});

	const createViewMutation = useMutation(api.views.createView);
	const deleteViewMutation = useMutation(api.views.deleteView);
	const touchViewMutation = useMutation(api.views.touchView);

	const views: SavedView[] =
		listResult?.map((v) => ({
			id: v.id as string,
			name: v.name,
			entity: v.entity as SavedViewEntity,
			pageId: v.pageId,
			filtersJson: v.filtersJson,
			displaySettingsJson: v.displaySettingsJson,
			description: v.description,
			createdAt: new Date(v.createdAt).toISOString(),
			updatedAt: new Date(v.updatedAt).toISOString(),
			lastUsedAt: v.lastUsedAt
				? new Date(v.lastUsedAt).toISOString()
				: undefined,
		})) ?? [];

	const activeViewId: string | null = null;

	const activeView = useMemo(() => {
		if (!activeViewId) return null;
		return views.find((view) => view.id === activeViewId) || null;
	}, [views, activeViewId]);

	const createCurrentView = (name: string, description?: string): string => {
		const filtersJson = filterStore.getState().toJSON();
		const displaySettingsJson = displaySettingsStore.getState().toJSON();
		void createViewMutation({
			entity,
			pageId,
			name,
			description,
			filtersJson,
			displaySettingsJson,
		});
		return "";
	};

	const applyView = (viewId: string): void => {
		const view = views.find((v) => v.id === viewId);
		if (!view) return;

		filterStore.getState().fromJSON(view.filtersJson);
		displaySettingsStore.getState().fromJSON(view.displaySettingsJson);
		void touchViewMutation({ id: viewId as never });
	};

	const deleteView = (viewId: string): void => {
		void deleteViewMutation({ id: viewId as never });
		if (viewId === activeViewId) {
			filterStore.getState().clearFilters();
			displaySettingsStore
				.getState()
				.fromJSON(displaySettingsStore.getState().toJSON());
		}
	};

	return {
		views,
		activeViewId,
		activeView,
		setActiveView: () => {},
		createCurrentView,
		applyView,
		deleteView,
	};
}
