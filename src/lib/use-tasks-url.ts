"use client";

import { useQueryStates } from "nuqs";
import {
	tasksFilterParsers,
	parseDateRangeFromNuqs,
	serializeDateRangeToNuqs,
	normalizeFilterItems,
} from "./nuqs-parsers";
import type { TasksFilters } from "@/lib/filter-types";
import type { MatchMode, DateRangeFilter } from "@/lib/filter-types";

export interface TasksUrlState {
	filters: TasksFilters;
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

export interface TasksUrlActions {
	setArrayFilter: <K extends Exclude<keyof TasksFilters, "dateRange">>(
		key: K,
		value: TasksFilters[K],
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

export function useTasksUrl(): TasksUrlState & TasksUrlActions {
	const [params, setParams] = useQueryStates(tasksFilterParsers, {
		history: "replace",
		shallow: false,
	});

	const filters: TasksFilters = {
		status: normalizeFilterItems(params.status),
		priority: normalizeFilterItems(params.priority),
		assignee: normalizeFilterItems(params.assignee),
		labels: normalizeFilterItems(params.labels),
		owner: normalizeFilterItems(params.owner),
		parentType: normalizeFilterItems(params.parentType),
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

	const setArrayFilter: TasksUrlActions["setArrayFilter"] = (key, value) => {
		const nextValue = value.length ? value : null;
		switch (key) {
			case "status":
				setParams({ status: nextValue });
				return;
			case "priority":
				setParams({ priority: nextValue });
				return;
			case "assignee":
				setParams({ assignee: nextValue });
				return;
			case "labels":
				setParams({ labels: nextValue });
				return;
			case "owner":
				setParams({ owner: nextValue });
				return;
			case "parentType":
				setParams({ parentType: nextValue });
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
			status: null,
			priority: null,
			assignee: null,
			labels: null,
			owner: null,
			parentType: null,
			dateStart: null,
			dateEnd: null,
			dateIsNot: null,
			match: null,
		});
	};

	const clearAll = () => {
		setParams({
			view: null,
			status: null,
			priority: null,
			assignee: null,
			labels: null,
			owner: null,
			parentType: null,
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
