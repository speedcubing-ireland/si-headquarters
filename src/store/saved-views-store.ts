import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SavedViewEntity = "tasks" | "competitions";

export interface SavedView {
	id: string;
	name: string;
	entity: SavedViewEntity;
	filtersJson: string;
	displaySettingsJson: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

interface SavedViewsState {
	views: SavedView[];
	activeViewByEntity: Record<SavedViewEntity, string | null>;

	createView: (
		entity: SavedViewEntity,
		name: string,
		filtersJson: string,
		displaySettingsJson: string,
		description?: string,
	) => string;
	updateView: (
		id: string,
		updates: Partial<Pick<SavedView, "name" | "description">>,
	) => void;
	deleteView: (id: string) => void;
	setActiveView: (entity: SavedViewEntity, viewId: string | null) => void;
	getViewsForEntity: (entity: SavedViewEntity) => SavedView[];
	getActiveView: (entity: SavedViewEntity) => SavedView | null;
	resetAll: () => void;
}

const STORAGE_KEY = "hq_saved_views_v1";

function generateViewId(): string {
	return `view_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useSavedViewsStore = create<SavedViewsState>()(
	persist(
		(set, get) => ({
			views: [],
			activeViewByEntity: {
				tasks: null,
				competitions: null,
			},

			createView: (
				entity,
				name,
				filtersJson,
				displaySettingsJson,
				description,
			) => {
				const now = new Date().toISOString();
				const id = generateViewId();
				const newView: SavedView = {
					id,
					name,
					entity,
					filtersJson,
					displaySettingsJson,
					description,
					createdAt: now,
					updatedAt: now,
				};

				set((state) => ({
					views: [...state.views, newView],
					activeViewByEntity: {
						...state.activeViewByEntity,
						[entity]: id,
					},
				}));

				return id;
			},

			updateView: (id, updates) => {
				set((state) => ({
					views: state.views.map((view) =>
						view.id === id
							? { ...view, ...updates, updatedAt: new Date().toISOString() }
							: view,
					),
				}));
			},

			deleteView: (id) => {
				set((state) => {
					const view = state.views.find((v) => v.id === id);
					if (!view) return state;

					const newViews = state.views.filter((v) => v.id !== id);
					const newActiveViewByEntity = { ...state.activeViewByEntity };

					// Clear active view if it was deleted
					if (newActiveViewByEntity[view.entity] === id) {
						newActiveViewByEntity[view.entity] = null;
					}

					return {
						views: newViews,
						activeViewByEntity: newActiveViewByEntity,
					};
				});
			},

			setActiveView: (entity, viewId) => {
				set((state) => ({
					activeViewByEntity: {
						...state.activeViewByEntity,
						[entity]: viewId,
					},
				}));
			},

			getViewsForEntity: (entity) => {
				return get().views.filter((view) => view.entity === entity);
			},

			getActiveView: (entity) => {
				const activeId = get().activeViewByEntity[entity];
				if (!activeId) return null;
				return get().views.find((view) => view.id === activeId) || null;
			},

			resetAll: () => {
				set({
					views: [],
					activeViewByEntity: {
						tasks: null,
						competitions: null,
					},
				});
			},
		}),
		{
			name: STORAGE_KEY,
		},
	),
);
