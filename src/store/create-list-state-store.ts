import { create } from "zustand";
import type { MatchMode } from "@/lib/filter-types";
import type { DisplaySettings } from "@/lib/saved-view-utils";

export type ListPageSnapshot<TFilters> = {
	filters: TFilters;
	matchMode: MatchMode;
	displaySettings: DisplaySettings;
	viewId: string | null;
};

type ListPageRecord<TFilters> = ListPageSnapshot<TFilters> & {
	baseFilters: TFilters;
	baseDisplaySettings: DisplaySettings;
};

type EnsurePageInput<TFilters> = {
	baseFilters: TFilters;
	baseDisplaySettings: DisplaySettings;
};

type CreateListStateStoreOptions<TFilters> = {
	cloneFilters: (filters: TFilters) => TFilters;
};

type ListPageUpdater<TFilters> = (
	current: ListPageSnapshot<TFilters>,
) => ListPageSnapshot<TFilters>;

type ListStateStore<TFilters> = {
	pages: Record<string, ListPageRecord<TFilters>>;
	ensurePage: (pageId: string, input: EnsurePageInput<TFilters>) => void;
	updatePage: (pageId: string, updater: ListPageUpdater<TFilters>) => void;
	resetPage: (pageId: string) => void;
};

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

function createPageRecord<TFilters>(
	input: EnsurePageInput<TFilters>,
	cloneFilters: (filters: TFilters) => TFilters,
): ListPageRecord<TFilters> {
	const baseFilters = cloneFilters(input.baseFilters);
	const baseDisplaySettings = cloneDisplaySettings(input.baseDisplaySettings);

	return {
		filters: cloneFilters(baseFilters),
		matchMode: "all",
		displaySettings: cloneDisplaySettings(baseDisplaySettings),
		viewId: null,
		baseFilters,
		baseDisplaySettings,
	};
}

function toSnapshot<TFilters>(
	record: ListPageRecord<TFilters>,
	cloneFilters: (filters: TFilters) => TFilters,
): ListPageSnapshot<TFilters> {
	return {
		filters: cloneFilters(record.filters),
		matchMode: record.matchMode,
		displaySettings: cloneDisplaySettings(record.displaySettings),
		viewId: record.viewId,
	};
}

function toRecord<TFilters>(
	record: ListPageRecord<TFilters>,
	snapshot: ListPageSnapshot<TFilters>,
	cloneFilters: (filters: TFilters) => TFilters,
): ListPageRecord<TFilters> {
	return {
		...record,
		filters: cloneFilters(snapshot.filters),
		matchMode: snapshot.matchMode,
		displaySettings: cloneDisplaySettings(snapshot.displaySettings),
		viewId: snapshot.viewId,
	};
}

export function createListStateStore<TFilters>({
	cloneFilters,
}: CreateListStateStoreOptions<TFilters>) {
	return create<ListStateStore<TFilters>>((set) => ({
		pages: {},
		ensurePage: (pageId, input) => {
			set((state) => {
				const existing = state.pages[pageId];
				const baseFilters = cloneFilters(input.baseFilters);
				const baseDisplaySettings = cloneDisplaySettings(
					input.baseDisplaySettings,
				);

				if (!existing) {
					return {
						pages: {
							...state.pages,
							[pageId]: createPageRecord(
								{ baseFilters, baseDisplaySettings },
								cloneFilters,
							),
						},
					};
				}

				return {
					pages: {
						...state.pages,
						[pageId]: {
							...existing,
							baseFilters,
							baseDisplaySettings,
						},
					},
				};
			});
		},
		updatePage: (pageId, updater) => {
			set((state) => {
				const existing = state.pages[pageId];
				if (!existing) return state;

				const nextSnapshot = updater(toSnapshot(existing, cloneFilters));
				return {
					pages: {
						...state.pages,
						[pageId]: toRecord(existing, nextSnapshot, cloneFilters),
					},
				};
			});
		},
		resetPage: (pageId) => {
			set((state) => {
				const existing = state.pages[pageId];
				if (!existing) return state;

				return {
					pages: {
						...state.pages,
						[pageId]: {
							...existing,
							filters: cloneFilters(existing.baseFilters),
							matchMode: "all",
							displaySettings: cloneDisplaySettings(
								existing.baseDisplaySettings,
							),
							viewId: null,
						},
					},
				};
			});
		},
	}));
}
