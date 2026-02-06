import { createContext, useContext, type ReactNode } from "react";
import {
	useCompetitionsUrl,
	type CompetitionsUrlState,
	type CompetitionsUrlActions,
	type UseCompetitionsUrlOptions,
} from "./use-competitions-url";
import type { CompetitionsFilters } from "@/lib/filter-types";
import type { DisplaySettings } from "@/lib/saved-view-utils";

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
	pageId?: UseCompetitionsUrlOptions["pageId"];
	defaultFilters?: Partial<CompetitionsFilters>;
	defaultDisplaySettings?: Partial<DisplaySettings>;
}

export function CompetitionsUrlProvider({
	children,
	pageId,
	defaultFilters,
	defaultDisplaySettings,
}: CompetitionsUrlProviderProps) {
	const urlState = useCompetitionsUrl({
		pageId,
		defaultFilters,
		defaultDisplaySettings,
	});

	return (
		<CompetitionsUrlContext.Provider value={urlState}>
			{children}
		</CompetitionsUrlContext.Provider>
	);
}
