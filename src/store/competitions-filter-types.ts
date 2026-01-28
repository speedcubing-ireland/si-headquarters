import type { Priority, Status } from "@/data/types";

export type MatchMode = "any" | "all";

export type FilterItem<T> = {
	values: T[];
	isNot: boolean;
};

export type DateRangeFilter = {
	start?: string;
	end?: string;
	isNot?: boolean;
};

export type CompetitionsFilters = {
	status: FilterItem<Status>[];
	priority: FilterItem<Priority>[];
	leads: FilterItem<string>[];
	dateRange?: DateRangeFilter;
};

