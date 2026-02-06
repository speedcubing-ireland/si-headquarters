"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
	useTasksUrl,
	type TasksUrlState,
	type TasksUrlActions,
} from "./use-tasks-url";

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
}

export function TasksUrlProvider({ children }: TasksUrlProviderProps) {
	const urlState = useTasksUrl();

	return (
		<TasksUrlContext.Provider value={urlState}>
			{children}
		</TasksUrlContext.Provider>
	);
}
