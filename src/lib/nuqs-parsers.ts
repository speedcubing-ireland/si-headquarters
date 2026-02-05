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

function parseFilterItem(value: string): FilterItem<string> | null {
	const parts = value.split("|");
	if (parts.length !== 2) return null;

	const values = parts[0].split(",").filter(Boolean);
	const isNot = parts[1] === "1";

	if (values.length === 0) return null;

	return { values, isNot };
}

function serializeFilterItem(item: FilterItem<string>): string {
	return `${item.values.join(",")}|${item.isNot ? "1" : "0"}`;
}

const parseAsFilterItem = createParser({
	parse(value: string) {
		const parsed = parseFilterItem(value);
		if (!parsed) return null;
		return parsed;
	},
	serialize(item: FilterItem<string>) {
		return serializeFilterItem(item);
	},
});

const parseAsFilterItems = parseAsNativeArrayOf(parseAsFilterItem);

const parseAsMatchMode = parseAsStringEnum<MatchMode>([
	"any",
	"all",
]).withDefault("all");

const parseAsViewId = parseAsString;

const parseAsDateStart = parseAsString;

const parseAsDateEnd = parseAsString;

const parseAsDateIsNot = parseAsStringEnum(["0", "1"]).withDefault("0");

const parseAsGrouping = parseAsString;

const parseAsSubGrouping = parseAsString;

const parseAsOrderField = parseAsString;

const parseAsOrderDir = parseAsStringEnum<"asc" | "desc">([
	"asc",
	"desc",
]).withDefault("asc");

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
