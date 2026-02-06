import { createContext, useContext, type ReactNode } from "react";
import {
	useTasksUrl,
	type TasksUrlState,
	type TasksUrlActions,
	type UseTasksUrlOptions,
} from "./use-tasks-url";
import type { TasksFilters } from "@/lib/filter-types";
import type { DisplaySettings } from "@/lib/saved-view-utils";

export interface TasksUrlContextValue extends TasksUrlState, TasksUrlActions {}

const TasksUrlContext = createContext<TasksUrlContextValue | null>(null);

export function useTasksUrlContext() {
	const context = useContext(TasksUrlContext);
	if (!context) {
		throw new Error(
			"useTasksUrlContext must be used within a TasksUrlProvider",
		);
	}
	return context;
}

interface TasksUrlProviderProps {
	children: ReactNode;
	pageId: UseTasksUrlOptions["pageId"];
	defaultFilters?: Partial<TasksFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
}

export function TasksUrlProvider({
	children,
	pageId,
	defaultFilters,
	defaultDisplaySettings,
}: TasksUrlProviderProps) {
	const urlState = useTasksUrl({
		pageId,
		defaultFilters,
		defaultDisplaySettings,
	});

	return (
		<TasksUrlContext.Provider value={urlState}>
			{children}
		</TasksUrlContext.Provider>
	);
}
