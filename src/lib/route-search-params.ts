import { z } from "zod";
import type { DateRangeFilter, FilterItem } from "@/store/shared-filter-types";

/**
 * URL Search Parameter Schemas
 *
 * These schemas define how filter and display settings are serialized to/from URLs
 *
 * Complex filters are encoded as: filterName=values|isNot
 * Examples:
 * - Single filter: ?assignee=user1|0 (assignee is user1)
 * - Multiple filters: ?assignee=user1,user2|0 (assignee is user1 OR user2)
 * - Negated filter: ?assignee=user1|1 (assignee is NOT user1)
 * - Multiple filter items: ?assignee=user1|0&assignee=user2|1 (assignee is user1 AND NOT user2)
 *
 * Date range: ?dateStart=2024-01-01&dateEnd=2024-12-31&dateIsNot=0
 * Match mode: ?match=any or ?match=all (default: all)
 * Display: ?grouping=status&subGrouping=priority&orderField=dueDate&orderDir=asc
 * Saved view: ?view=view-id (overrides all other params)
 */

// Schema for a single filter item value encoded as "value1,value2|isNot"
const filterItemSchema = z.string().transform((val) => {
	const parts = val.split("|");
	if (parts.length !== 2) return null;

	const values = parts[0].split(",").filter(Boolean);
	const isNot = parts[1] === "1";

	if (values.length === 0) return null;

	return { values, isNot };
});

// Schema for date range
const dateRangeSchema = z.object({
	dateStart: z.string().optional(),
	dateEnd: z.string().optional(),
	dateIsNot: z.enum(["0", "1"]).optional().default("0"),
});

// Tasks filter search params
export const tasksSearchSchema = z.object({
	// Saved view ID (takes precedence)
	view: z.string().optional(),

	// Filter items (can have multiple per type via array)
	status: z.union([z.string(), z.array(z.string())]).optional(),
	priority: z.union([z.string(), z.array(z.string())]).optional(),
	assignee: z.union([z.string(), z.array(z.string())]).optional(),
	labels: z.union([z.string(), z.array(z.string())]).optional(),
	owner: z.union([z.string(), z.array(z.string())]).optional(),
	parentType: z.union([z.string(), z.array(z.string())]).optional(),

	// Date range
	...dateRangeSchema.shape,

	// Match mode
	match: z.enum(["any", "all"]).optional().default("all"),

	// Display settings
	grouping: z.string().optional(),
	subGrouping: z.string().optional(),
	orderField: z.string().optional(),
	orderDir: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type TasksSearchParams = z.infer<typeof tasksSearchSchema>;

// Competitions filter search params
export const competitionsSearchSchema = z.object({
	view: z.string().optional(),

	phase: z.union([z.string(), z.array(z.string())]).optional(),
	compLead: z.union([z.string(), z.array(z.string())]).optional(),
	leadDelegate: z.union([z.string(), z.array(z.string())]).optional(),
	organisers: z.union([z.string(), z.array(z.string())]).optional(),

	...dateRangeSchema.shape,

	match: z.enum(["any", "all"]).optional().default("all"),

	grouping: z.string().optional(),
	subGrouping: z.string().optional(),
	orderField: z.string().optional(),
	orderDir: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type CompetitionsSearchParams = z.infer<typeof competitionsSearchSchema>;

/**
 * Parse filter items from search params
 * Handles both single string and array of strings
 */
function parseFilterItemsFromSearchParam(
	param: string | string[] | undefined,
): FilterItem<string>[] | undefined {
	if (!param) return undefined;

	const items: FilterItem<string>[] = [];
	const paramArray = Array.isArray(param) ? param : [param];

	for (const itemStr of paramArray) {
		const parsed = filterItemSchema.safeParse(itemStr);
		if (parsed.success && parsed.data) {
			items.push(parsed.data);
		}
	}

	return items.length > 0 ? items : undefined;
}

/**
 * Serialize filter items to search param string
 */
function serializeFilterItems(
	items: FilterItem<string>[] | undefined,
): string[] | undefined {
	if (!items || items.length === 0) return undefined;

	// Multiple items become multiple query params with same key
	return items.map(
		(item) => `${item.values.join(",")}|${item.isNot ? "1" : "0"}`,
	);
}

/**
 * Parse date range from search params
 */
export function parseDateRangeFromSearch(params: {
	dateStart?: string;
	dateEnd?: string;
	dateIsNot?: string;
}): DateRangeFilter | undefined {
	if (!params.dateStart && !params.dateEnd) return undefined;

	return {
		start: params.dateStart,
		end: params.dateEnd,
		isNot: params.dateIsNot === "1",
	};
}

/**
 * Serialize date range to search params object
 */
export function serializeDateRangeToSearch(
	dateRange: DateRangeFilter | undefined,
): {
	dateStart?: string;
	dateEnd?: string;
	dateIsNot?: string;
} {
	if (!dateRange) return {};

	return {
		dateStart: dateRange.start,
		dateEnd: dateRange.end,
		dateIsNot: dateRange.isNot ? "1" : "0",
	};
}

/**
 * Parse tasks filters from search params
 */
export function parseTasksFiltersFromSearch(params: TasksSearchParams) {
	return {
		status: parseFilterItemsFromSearchParam(params.status),
		priority: parseFilterItemsFromSearchParam(params.priority),
		assignee: parseFilterItemsFromSearchParam(params.assignee),
		labels: parseFilterItemsFromSearchParam(params.labels),
		owner: parseFilterItemsFromSearchParam(params.owner),
		parentType: parseFilterItemsFromSearchParam(params.parentType),
		dateRange: parseDateRangeFromSearch(params),
	};
}

/**
 * Parse competitions filters from search params
 */
export function parseCompetitionsFiltersFromSearch(
	params: CompetitionsSearchParams,
) {
	return {
		phase: parseFilterItemsFromSearchParam(params.phase),
		compLead: parseFilterItemsFromSearchParam(params.compLead),
		leadDelegate: parseFilterItemsFromSearchParam(params.leadDelegate),
		organisers: parseFilterItemsFromSearchParam(params.organisers),
		dateRange: parseDateRangeFromSearch(params),
	};
}

/**
 * Serialize tasks filters to search params
 */
export function serializeTasksFiltersToSearch(filters: {
	status: FilterItem<string>[];
	priority: FilterItem<string>[];
	assignee: FilterItem<string>[];
	labels: FilterItem<string>[];
	owner: FilterItem<string>[];
	parentType: FilterItem<string>[];
	dateRange?: DateRangeFilter;
}): Record<string, string | string[]> {
	const params: Record<string, string | string[]> = {};

	const filterMappings: Record<string, FilterItem<string>[] | undefined> = {
		status: filters.status,
		priority: filters.priority,
		assignee: filters.assignee,
		labels: filters.labels,
		owner: filters.owner,
		parentType: filters.parentType,
	};

	for (const [key, items] of Object.entries(filterMappings)) {
		if (items && items.length > 0) {
			const serialized = serializeFilterItems(items);
			if (serialized) {
				params[key] = serialized.length === 1 ? serialized[0] : serialized;
			}
		}
	}

	if (filters.dateRange) {
		const dateParams = serializeDateRangeToSearch(filters.dateRange);
		Object.assign(params, dateParams);
	}

	return params;
}

/**
 * Serialize competitions filters to search params
 */
export function serializeCompetitionsFiltersToSearch(filters: {
	phase: FilterItem<string>[];
	compLead: FilterItem<string>[];
	leadDelegate: FilterItem<string>[];
	organisers: FilterItem<string>[];
	dateRange?: DateRangeFilter;
}): Record<string, string | string[]> {
	const params: Record<string, string | string[]> = {};

	const filterMappings: Record<string, FilterItem<string>[] | undefined> = {
		phase: filters.phase,
		compLead: filters.compLead,
		leadDelegate: filters.leadDelegate,
		organisers: filters.organisers,
	};

	for (const [key, items] of Object.entries(filterMappings)) {
		if (items && items.length > 0) {
			const serialized = serializeFilterItems(items);
			if (serialized) {
				params[key] = serialized.length === 1 ? serialized[0] : serialized;
			}
		}
	}

	if (filters.dateRange) {
		const dateParams = serializeDateRangeToSearch(filters.dateRange);
		Object.assign(params, dateParams);
	}

	return params;
}

/**
 * Parse display settings from search params
 */
export function parseDisplaySettingsFromSearch(params: {
	grouping?: string;
	subGrouping?: string;
	orderField?: string;
	orderDir?: string;
}) {
	return {
		grouping: params.grouping || null,
		subGrouping: params.subGrouping || null,
		ordering: {
			field: params.orderField || null,
			direction: (params.orderDir as "asc" | "desc") || "asc",
		},
	};
}

/**
 * Serialize display settings to search params
 */
export function serializeDisplaySettingsToSearch(display: {
	grouping: string | null;
	subGrouping: string | null;
	ordering: { field: string | null; direction: "asc" | "desc" };
}): Record<string, string> {
	const params: Record<string, string> = {};

	if (display.grouping) params.grouping = display.grouping;
	if (display.subGrouping) params.subGrouping = display.subGrouping;
	if (display.ordering.field) params.orderField = display.ordering.field;
	if (display.ordering.direction !== "asc")
		params.orderDir = display.ordering.direction;

	return params;
}
