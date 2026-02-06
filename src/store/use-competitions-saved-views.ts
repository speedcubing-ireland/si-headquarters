"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { parseSavedViewId } from "@/lib/convex-ids";
import { useCompetitionsUrlContext } from "@/lib/competitions-url-context";
import type { SavedView, SavedViewEntity } from "@/store/saved-views-store";
import { emptyCompetitionsFilters } from "@/lib/filter-types";
import {
	parseDisplaySettingsJson,
	parseFiltersJson,
	serializeDisplaySettings,
	serializeFilters,
} from "@/lib/saved-view-utils";

export interface CompetitionsSavedViewsHook {
	views: SavedView[];
	activeViewId: string | null;
	activeView: SavedView | null;
	setActiveView: (viewId: string | null) => void;
	createCurrentView: (name: string, description?: string) => string;
	applyView: (viewId: string) => void;
	deleteView: (viewId: string) => void;
}

export function useCompetitionsSavedViews(): CompetitionsSavedViewsHook {
	const listResult = useQuery(api.views.listViews, {
		entity: "competitions",
		pageId: "all",
	});
	const createViewMutation = useMutation(api.views.createView);
	const deleteViewMutation = useMutation(api.views.deleteView);

	const {
		filters,
		matchMode,
		displaySettings,
		viewId,
		setView,
		clearAll,
		setArrayFilter,
		setMatchMode,
		setDateRange,
		setGrouping,
		setSubGrouping,
		setOrdering,
	} = useCompetitionsUrlContext();

	const views: SavedView[] = useMemo(
		() =>
			listResult?.map((v) => ({
				id: v.id,
				name: v.name,
				entity: v.entity as SavedViewEntity,
				pageId: v.pageId,
				filtersJson: v.filtersJson,
				displaySettingsJson: v.displaySettingsJson,
				description: v.description,
				createdAt: new Date(v.createdAt).toISOString(),
				updatedAt: new Date(v.updatedAt).toISOString(),
				lastUsedAt: v.lastUsedAt
					? new Date(v.lastUsedAt).toISOString()
					: undefined,
			})) ?? [],
		[listResult],
	);

	const activeViewId = viewId;

	const activeView = useMemo(
		() => views.find((view) => view.id === activeViewId) || null,
		[views, activeViewId],
	);

	const createCurrentView = useCallback(
		(name: string, description?: string): string => {
			const filtersJson = serializeFilters(filters, matchMode);
			const displaySettingsJson = serializeDisplaySettings(displaySettings);
			void createViewMutation({
				entity: "competitions",
				pageId: "all",
				name,
				description,
				filtersJson,
				displaySettingsJson,
			});
			return "";
		},
		[filters, matchMode, displaySettings, createViewMutation],
	);

	const applyView = useCallback(
		(viewId: string): void => {
			const view = views.find((v) => v.id === viewId);
			if (!view) return;

			const parsedFilters = parseFiltersJson(
				view.filtersJson,
				emptyCompetitionsFilters,
			);
			const parsedDisplay = parseDisplaySettingsJson(view.displaySettingsJson);
			setView(viewId);

			setArrayFilter("phase", parsedFilters.filters.phase);
			setArrayFilter("compLead", parsedFilters.filters.compLead);
			setArrayFilter("leadDelegate", parsedFilters.filters.leadDelegate);
			setArrayFilter("organisers", parsedFilters.filters.organisers);
			setDateRange(parsedFilters.filters.dateRange);
			setMatchMode(parsedFilters.matchMode);
			setGrouping(parsedDisplay.grouping);
			setSubGrouping(parsedDisplay.subGrouping);
			setOrdering(
				parsedDisplay.ordering.field,
				parsedDisplay.ordering.direction,
			);
		},
		[
			views,
			setView,
			setArrayFilter,
			setMatchMode,
			setDateRange,
			setGrouping,
			setSubGrouping,
			setOrdering,
		],
	);

	const deleteView = useCallback(
		(viewId: string): void => {
			const id = parseSavedViewId(viewId);
			if (id) void deleteViewMutation({ id });
			if (viewId === activeViewId) {
				clearAll();
			}
		},
		[activeViewId, clearAll, deleteViewMutation],
	);

	return {
		views,
		activeViewId,
		activeView,
		setActiveView: setView,
		createCurrentView,
		applyView,
		deleteView,
	};
}
