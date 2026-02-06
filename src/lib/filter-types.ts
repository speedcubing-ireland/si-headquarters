export type MatchMode = "any" | "all";

export type FilterItem = {
	values: string[];
	isNot: boolean;
};

export type DateRangeFilter = {
	start?: string;
	end?: string;
	isNot?: boolean;
};

export type TasksFilters = {
	status: FilterItem[];
	priority: FilterItem[];
	assignee: FilterItem[];
	labels: FilterItem[];
	owner: FilterItem[];
	parentType: FilterItem[];
	dateRange?: DateRangeFilter;
};

export const emptyTasksFilters: TasksFilters = {
	status: [],
	priority: [],
	assignee: [],
	labels: [],
	owner: [],
	parentType: [],
	dateRange: undefined,
};

export type CompetitionsFilters = {
	phase: FilterItem[];
	compLead: FilterItem[];
	leadDelegate: FilterItem[];
	organisers: FilterItem[];
	dateRange?: DateRangeFilter;
};

export const emptyCompetitionsFilters: CompetitionsFilters = {
	phase: [],
	compLead: [],
	leadDelegate: [],
	organisers: [],
	dateRange: undefined,
};
