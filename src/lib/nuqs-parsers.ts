import {
	parseAsString,
	parseAsStringEnum,
	createParser,
	parseAsNativeArrayOf,
} from "nuqs";
import type {
	FilterItem,
	DateRangeFilter,
	MatchMode,
} from "@/store/shared-filter-types";

/**
 * Parse a single filter item from URL format: "value1,value2|isNot"
 */
function parseFilterItem(value: string): FilterItem<string> | null {
	const parts = value.split("|");
	if (parts.length !== 2) return null;

	const values = parts[0].split(",").filter(Boolean);
	const isNot = parts[1] === "1";

	if (values.length === 0) return null;

	return { values, isNot };
}

/**
 * Serialize a filter item to URL format: "value1,value2|isNot"
 */
function serializeFilterItem(item: FilterItem<string>): string {
	return `${item.values.join(",")}|${item.isNot ? "1" : "0"}`;
}

/**
 * Parser for a single filter item (string format: "values|isNot")
 */
export const parseAsFilterItem = createParser({
	parse(value: string) {
		const parsed = parseFilterItem(value);
		if (!parsed) return null;
		return parsed;
	},
	serialize(item: FilterItem<string>) {
		return serializeFilterItem(item);
	},
});

/**
 * Parser for an array of filter items
 * Uses parseAsNativeArrayOf to handle multiple URL params: ?status=a|0&status=b|1
 */
export const parseAsFilterItems = parseAsNativeArrayOf(parseAsFilterItem);

/**
 * Parser for match mode
 */
export const parseAsMatchMode = parseAsStringEnum<MatchMode>([
	"any",
	"all",
]).withDefault("all");

/**
 * Parser for saved view ID
 */
export const parseAsViewId = parseAsString;

/**
 * Parser for date start
 */
export const parseAsDateStart = parseAsString;

/**
 * Parser for date end
 */
export const parseAsDateEnd = parseAsString;

/**
 * Parser for date isNot flag
 */
export const parseAsDateIsNot = parseAsStringEnum(["0", "1"]).withDefault("0");

/**
 * Parser for grouping
 */
export const parseAsGrouping = parseAsString;

/**
 * Parser for subGrouping
 */
export const parseAsSubGrouping = parseAsString;

/**
 * Parser for order field
 */
export const parseAsOrderField = parseAsString;

/**
 * Parser for order direction
 */
export const parseAsOrderDir = parseAsStringEnum<"asc" | "desc">([
	"asc",
	"desc",
]).withDefault("asc");

/**
 * Tasks filter parsers
 */
export const tasksFilterParsers = {
	view: parseAsViewId,
	status: parseAsFilterItems,
	priority: parseAsFilterItems,
	assignee: parseAsFilterItems,
	labels: parseAsFilterItems,
	owner: parseAsFilterItems,
	parentType: parseAsFilterItems,
	dateStart: parseAsDateStart,
	dateEnd: parseAsDateEnd,
	dateIsNot: parseAsDateIsNot,
	match: parseAsMatchMode,
	grouping: parseAsGrouping,
	subGrouping: parseAsSubGrouping,
	orderField: parseAsOrderField,
	orderDir: parseAsOrderDir,
} as const;

/**
 * Competitions filter parsers
 */
export const competitionsFilterParsers = {
	view: parseAsViewId,
	phase: parseAsFilterItems,
	compLead: parseAsFilterItems,
	leadDelegate: parseAsFilterItems,
	organisers: parseAsFilterItems,
	dateStart: parseAsDateStart,
	dateEnd: parseAsDateEnd,
	dateIsNot: parseAsDateIsNot,
	match: parseAsMatchMode,
	grouping: parseAsGrouping,
	subGrouping: parseAsSubGrouping,
	orderField: parseAsOrderField,
	orderDir: parseAsOrderDir,
} as const;

/**
 * Helper to parse date range from URL params
 */
export function parseDateRangeFromNuqs(params: {
	dateStart: string | null;
	dateEnd: string | null;
	dateIsNot: string | null;
}): DateRangeFilter | undefined {
	if (!params.dateStart && !params.dateEnd) return undefined;

	return {
		start: params.dateStart ?? undefined,
		end: params.dateEnd ?? undefined,
		isNot: params.dateIsNot === "1",
	};
}

/**
 * Helper to serialize date range to URL params
 */
export function serializeDateRangeToNuqs(
	dateRange: DateRangeFilter | undefined,
): {
	dateStart: string | null;
	dateEnd: string | null;
	dateIsNot: string | null;
} {
	if (!dateRange) {
		return { dateStart: null, dateEnd: null, dateIsNot: null };
	}

	return {
		dateStart: dateRange.start ?? null,
		dateEnd: dateRange.end ?? null,
		dateIsNot: dateRange.isNot ? "1" : "0",
	};
}
