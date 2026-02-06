"use client";

import { useQueryStates } from "nuqs";
import {
	competitionsFilterParsers,
	parseDateRangeFromNuqs,
	serializeDateRangeToNuqs,
	normalizeFilterItems,
} from "./nuqs-parsers";
import type { CompetitionsFilters } from "@/lib/filter-types";
import type { MatchMode, DateRangeFilter } from "@/lib/filter-types";

export interface CompetitionsUrlState {
	filters: CompetitionsFilters;
	matchMode: MatchMode;
	displaySettings: {
		grouping: string | null;
		subGrouping: string | null;
		ordering: {
			field: string | null;
			direction: "asc" | "desc";
		};
	};
	viewId: string | null;
	isViewActive: boolean;
}

export interface CompetitionsUrlActions {
	setArrayFilter: <K extends Exclude<keyof CompetitionsFilters, "dateRange">>(
		key: K,
		value: CompetitionsFilters[K],
	) => void;
	setMatchMode: (mode: MatchMode) => void;
	setDateRange: (range: DateRangeFilter | undefined) => void;
	setGrouping: (grouping: string | null) => void;
	setSubGrouping: (subGrouping: string | null) => void;
	setOrdering: (field: string | null, direction: "asc" | "desc") => void;
	setView: (viewId: string | null) => void;
	clearFilters: () => void;
	clearAll: () => void;
}

export function useCompetitionsUrl(): CompetitionsUrlState &
	CompetitionsUrlActions {
	const [params, setParams] = useQueryStates(competitionsFilterParsers, {
		history: "replace",
		shallow: false,
	});

	const filters: CompetitionsFilters = {
		phase: normalizeFilterItems(params.phase),
		compLead: normalizeFilterItems(params.compLead),
		leadDelegate: normalizeFilterItems(params.leadDelegate),
		organisers: normalizeFilterItems(params.organisers),
		dateRange: parseDateRangeFromNuqs({
			dateStart: params.dateStart,
			dateEnd: params.dateEnd,
			dateIsNot: params.dateIsNot,
		}),
	};

	const displaySettings = {
		grouping: params.grouping ?? null,
		subGrouping: params.subGrouping ?? null,
		ordering: {
			field: params.orderField ?? null,
			direction: params.orderDir ?? "asc",
		},
	};

	const setArrayFilter: CompetitionsUrlActions["setArrayFilter"] = (
		key,
		value,
	) => {
		const nextValue = value.length ? value : null;
		switch (key) {
			case "phase":
				setParams({ phase: nextValue });
				return;
			case "compLead":
				setParams({ compLead: nextValue });
				return;
			case "leadDelegate":
				setParams({ leadDelegate: nextValue });
				return;
			case "organisers":
				setParams({ organisers: nextValue });
				return;
		}
	};

	const setMatchMode = (mode: MatchMode) => {
		setParams({ match: mode === "all" ? null : mode });
	};

	const setDateRange = (range: DateRangeFilter | undefined) => {
		const dateParams = serializeDateRangeToNuqs(range);
		setParams({
			dateStart: dateParams.dateStart,
			dateEnd: dateParams.dateEnd,
			dateIsNot: dateParams.dateIsNot ?? "0",
		});
	};

	const setGrouping = (grouping: string | null) => {
		setParams({
			grouping: grouping,
			subGrouping: null,
		});
	};

	const setSubGrouping = (subGrouping: string | null) => {
		setParams({ subGrouping });
	};

	const setOrdering = (field: string | null, direction: "asc" | "desc") => {
		setParams({
			orderField: field,
			orderDir: direction,
		});
	};

	const setView = (viewId: string | null) => {
		setParams({ view: viewId });
	};

	const clearFilters = () => {
		setParams({
			phase: null,
			compLead: null,
			leadDelegate: null,
			organisers: null,
			dateStart: null,
			dateEnd: null,
			dateIsNot: null,
			match: null,
		});
	};

	const clearAll = () => {
		setParams({
			view: null,
			phase: null,
			compLead: null,
			leadDelegate: null,
			organisers: null,
			dateStart: null,
			dateEnd: null,
			dateIsNot: null,
			match: null,
			grouping: null,
			subGrouping: null,
			orderField: null,
			orderDir: null,
		});
	};

	return {
		filters,
		matchMode: params.match ?? "all",
		displaySettings,
		viewId: params.view ?? null,
		isViewActive: !!params.view,
		setArrayFilter,
		setMatchMode,
		setDateRange,
		setGrouping,
		setSubGrouping,
		setOrdering,
		setView,
		clearFilters,
		clearAll,
	};
}
