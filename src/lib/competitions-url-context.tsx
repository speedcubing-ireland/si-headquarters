"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
	useCompetitionsUrl,
	type CompetitionsUrlState,
	type CompetitionsUrlActions,
} from "./use-competitions-url";

export interface CompetitionsUrlContextValue
	extends CompetitionsUrlState,
		CompetitionsUrlActions {}

const CompetitionsUrlContext =
	createContext<CompetitionsUrlContextValue | null>(null);

export function useCompetitionsUrlContext() {
	const context = useContext(CompetitionsUrlContext);
	if (!context) {
		throw new Error(
			"useCompetitionsUrlContext must be used within a CompetitionsUrlProvider",
		);
	}
	return context;
}

interface CompetitionsUrlProviderProps {
	children: ReactNode;
}

export function CompetitionsUrlProvider({
	children,
}: CompetitionsUrlProviderProps) {
	const urlState = useCompetitionsUrl();

	return (
		<CompetitionsUrlContext.Provider value={urlState}>
			{children}
		</CompetitionsUrlContext.Provider>
	);
}
