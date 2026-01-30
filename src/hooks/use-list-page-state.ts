import { useState } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { EntitySavedViewsHook } from "@/store/use-entity-saved-views";

const defaultDisplayJson = JSON.stringify({
	grouping: null,
	subGrouping: null,
	ordering: { field: null, direction: "asc" },
});

type FilterStore = UseBoundStore<
	StoreApi<{
		toJSON: () => string;
		fromJSON: (json: string) => void;
		clearFilters: () => void;
	}>
>;
type DisplayStore = UseBoundStore<
	StoreApi<{ toJSON: () => string; fromJSON: (json: string) => void }>
>;

export interface UseListPageStateOptions {
	filterStore: FilterStore;
	displayStore: DisplayStore;
	savedViews: EntitySavedViewsHook;
}

export interface ListPageState {
	modalOpen: boolean;
	setModalOpen: (open: boolean) => void;
	isCreatingView: boolean;
	viewName: string;
	setViewName: (v: string) => void;
	viewDescription: string;
	setViewDescription: (v: string) => void;
	handleStartCreateView: () => void;
	handleCancelCreateView: () => void;
	handleSaveView: () => void;
	handleViewSelect: (viewId: string) => void;
	handleResetAll: () => void;
	// Row selection state (TanStack Table format: { rowId: boolean })
	rowSelection: Record<string, boolean>;
	setRowSelection: (
		updater:
			| Record<string, boolean>
			| ((prev: Record<string, boolean>) => Record<string, boolean>),
	) => void;
	clearRowSelection: () => void;
	selectedIds: string[];
	hasSelection: boolean;
}

export function useListPageState({
	filterStore,
	displayStore,
	savedViews,
}: UseListPageStateOptions): ListPageState {
	const [modalOpen, setModalOpen] = useState(false);
	const [isCreatingView, setIsCreatingView] = useState(false);
	const [viewName, setViewName] = useState("");
	const [viewDescription, setViewDescription] = useState("");
	const [previousFiltersJson, setPreviousFiltersJson] = useState<string | null>(
		null,
	);
	const [previousDisplayJson, setPreviousDisplayJson] = useState<string | null>(
		null,
	);
	const [rowSelection, setRowSelectionState] = useState<
		Record<string, boolean>
	>({});

	// Derived selection state
	const selectedIds = Object.keys(rowSelection).filter(
		(id) => rowSelection[id],
	);
	const hasSelection = selectedIds.length > 0;

	// Row selection updater (supports both direct value and updater function)
	const setRowSelection = (
		updater:
			| Record<string, boolean>
			| ((prev: Record<string, boolean>) => Record<string, boolean>),
	) => {
		setRowSelectionState((prev) =>
			typeof updater === "function" ? updater(prev) : updater,
		);
	};

	const clearRowSelection = () => {
		setRowSelectionState({});
	};

	function resetCreateViewState() {
		setIsCreatingView(false);
		setViewName("");
		setViewDescription("");
		setPreviousFiltersJson(null);
		setPreviousDisplayJson(null);
	}

	const handleStartCreateView = () => {
		setPreviousFiltersJson(filterStore.getState().toJSON());
		setPreviousDisplayJson(displayStore.getState().toJSON());
		setViewName("");
		setViewDescription("");
		setIsCreatingView(true);
	};

	const handleCancelCreateView = () => {
		if (previousFiltersJson) {
			filterStore.getState().fromJSON(previousFiltersJson);
		}
		if (previousDisplayJson) {
			displayStore.getState().fromJSON(previousDisplayJson);
		}
		resetCreateViewState();
	};

	const handleSaveView = () => {
		if (!viewName.trim()) return;

		savedViews.createCurrentView(viewName, viewDescription || undefined);
		resetCreateViewState();
	};

	const handleViewSelect = (viewId: string) => {
		savedViews.applyView(viewId);
	};

	const handleResetAll = () => {
		filterStore.getState().clearFilters();
		displayStore.getState().fromJSON(defaultDisplayJson);
		savedViews.setActiveView(null);
	};

	return {
		modalOpen,
		setModalOpen,
		isCreatingView,
		viewName,
		setViewName,
		viewDescription,
		setViewDescription,
		handleStartCreateView,
		handleCancelCreateView,
		handleSaveView,
		handleViewSelect,
		handleResetAll,
		rowSelection,
		setRowSelection,
		clearRowSelection,
		selectedIds,
		hasSelection,
	};
}
