import { createContext, useContext, type ReactNode } from "react";
import { useTasksPageStore } from "./create-tasks-page-store";

export const TasksListStateContext = createContext<{
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
} | null>(null);

export function useTasksListStateContext() {
	const context = useContext(TasksListStateContext);
	if (!context) {
		throw new Error(
			"useTasksListStateContext must be used within a TasksPage (list state is provided by TasksPageInner)",
		);
	}
	return context;
}

export const TasksPageContext = createContext<{
	filterStore: ReturnType<typeof useTasksPageStore>["useFilters"];
	displayStore: ReturnType<typeof useTasksPageStore>["useDisplay"];
	savedViews: ReturnType<typeof useTasksPageStore>["useSavedViews"];
	pageId: string;
} | null>(null);

export function useTasksPageContext() {
	const context = useContext(TasksPageContext);
	if (!context) {
		throw new Error(
			"useTasksPageContext must be used within a TasksPageProvider",
		);
	}
	return context;
}

export function TasksPageProvider({
	children,
	pageId,
	config,
}: {
	children: ReactNode;
	pageId: string;
	config?: Parameters<typeof useTasksPageStore>[1];
}) {
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
