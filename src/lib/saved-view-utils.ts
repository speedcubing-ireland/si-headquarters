import type { MatchMode } from "@/lib/filter-types";

export type DisplaySettings = {
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
};

export const defaultDisplaySettings: DisplaySettings = {
	grouping: null,
	subGrouping: null,
	ordering: { field: null, direction: "asc" },
};

function cloneDefaultDisplaySettings(): DisplaySettings {
	return {
		grouping: null,
		subGrouping: null,
		ordering: { field: null, direction: "asc" },
	};
}

export function serializeFilters<TFilters>(
	filters: TFilters,
	matchMode: MatchMode,
): string {
	return JSON.stringify({ filters, matchMode });
}

export function parseFiltersJson<TFilters>(
	json: string,
	fallbackFilters: TFilters,
): { filters: TFilters; matchMode: MatchMode } {
	try {
		const data = JSON.parse(json) as Partial<{
			filters: TFilters;
			matchMode: MatchMode;
		}>;
		return {
			filters: data.filters ?? fallbackFilters,
			matchMode: data.matchMode ?? "all",
		};
	} catch {
		return { filters: fallbackFilters, matchMode: "all" };
	}
}

export function serializeDisplaySettings(settings: DisplaySettings): string {
	return JSON.stringify(settings);
}

export function parseDisplaySettingsJson(json: string): DisplaySettings {
	try {
		const data = JSON.parse(json) as Partial<DisplaySettings>;
		const ordering = data.ordering ?? defaultDisplaySettings.ordering;
		return {
			grouping: data.grouping ?? null,
			subGrouping: data.subGrouping ?? null,
			ordering: {
				field: ordering.field ?? null,
				direction: ordering.direction === "desc" ? "desc" : "asc",
			},
		};
	} catch {
		return cloneDefaultDisplaySettings();
	}
}
