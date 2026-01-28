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
