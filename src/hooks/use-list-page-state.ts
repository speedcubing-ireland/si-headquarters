import { useState } from "react";
import type { TasksSavedViewsHook } from "@/lib/use-tasks-saved-views";
import type { CompetitionsSavedViewsHook } from "@/store/use-competitions-saved-views";

export interface UseListPageStateOptions {
	savedViews: TasksSavedViewsHook | CompetitionsSavedViewsHook;
	getFiltersJson: () => string;
	getDisplaySettingsJson: () => string;
	restoreFiltersJson: (json: string) => void;
	restoreDisplaySettingsJson: (json: string) => void;
	resetAll: () => void;
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
	savedViews,
	getFiltersJson,
	getDisplaySettingsJson,
	restoreFiltersJson,
	restoreDisplaySettingsJson,
	resetAll,
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

	const selectedIds = Object.keys(rowSelection).filter(
		(id) => rowSelection[id],
	);
	const hasSelection = selectedIds.length > 0;

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
		setPreviousFiltersJson(getFiltersJson());
		setPreviousDisplayJson(getDisplaySettingsJson());
		setViewName("");
		setViewDescription("");
		setIsCreatingView(true);
	};

	const handleCancelCreateView = () => {
		if (previousFiltersJson) {
			restoreFiltersJson(previousFiltersJson);
		}
		if (previousDisplayJson) {
			restoreDisplaySettingsJson(previousDisplayJson);
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
		resetAll();
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
