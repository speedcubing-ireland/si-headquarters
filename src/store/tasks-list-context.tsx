import { createContext, useContext } from "react";

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
