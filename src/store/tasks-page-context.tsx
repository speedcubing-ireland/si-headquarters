import { createContext, useContext, type ReactNode } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import {
	useTasksPageStore,
	type TasksPageConfig,
} from "./create-tasks-page-store";
import type { TasksFilters } from "./tasks-filter-types";
import type { TaskFilterType } from "./tasks-filter-store";
import type { TaskPriority, TaskStatus } from "@/data/types-new";
import type { BaseFilterStoreState } from "./shared-filter-factory";
import type { DisplaySettingsState } from "./display-settings-factory";
import type { EntitySavedViewsHook } from "./use-entity-saved-views";

// Store types
export type TasksFilterStore = UseBoundStore<
	StoreApi<
		BaseFilterStoreState<
			TasksFilters,
			TaskFilterType,
			TaskStatus | TaskPriority | string
		>
	>
>;

export type TasksDisplayStore = UseBoundStore<StoreApi<DisplaySettingsState>>;

// Context type
export interface TasksPageContextValue {
	filterStore: TasksFilterStore;
	displayStore: TasksDisplayStore;
	savedViews: EntitySavedViewsHook;
	pageId: string;
}

// List state exposed to children (e.g. BulkActionsBar, custom bulk actions)
export interface TasksListState {
	selectedIds: string[];
	clearRowSelection: () => void;
	setModalOpen: (open: boolean) => void;
	modalOpen: boolean;
	hasSelection: boolean;
	rowSelection: Record<string, boolean>;
	setRowSelection: (
		updater:
			| Record<string, boolean>
			| ((prev: Record<string, boolean>) => Record<string, boolean>),
	) => void;
}

export const TasksListStateContext = createContext<TasksListState | null>(null);

export function useTasksListStateContext() {
	const context = useContext(TasksListStateContext);
	if (!context) {
		throw new Error(
			"useTasksListStateContext must be used within a TasksPage (list state is provided by TasksPageInner)",
		);
	}
	return context;
}

// Create context
export const TasksPageContext = createContext<TasksPageContextValue | null>(
	null,
);

// Hook to use the context
export function useTasksPageContext() {
	const context = useContext(TasksPageContext);
	if (!context) {
		throw new Error(
			"useTasksPageContext must be used within a TasksPageProvider",
		);
	}
	return context;
}

// Provider component
interface TasksPageProviderProps {
	children: ReactNode;
	pageId: string;
	config?: Omit<TasksPageConfig, "pageId">;
}

export function TasksPageProvider({
	children,
	pageId,
	config,
}: TasksPageProviderProps) {
	const stores = useTasksPageStore(pageId, config);

	return (
		<TasksPageContext.Provider
			value={{
				filterStore: stores.useFilters,
				displayStore: stores.useDisplay,
				savedViews: stores.useSavedViews,
				pageId,
			}}
		>
			{children}
		</TasksPageContext.Provider>
	);
}
