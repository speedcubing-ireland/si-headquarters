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
} from "@/lib/filter-types";
import {
	TASK_STATUSES,
	TASK_PRIORITIES,
	COMPETITION_PHASE_KEYS,
} from "@/data/types-new";

const TASK_PARENT_TYPES = ["task", "phase", "competition"] as const;

function parseFilterItem(value: string): FilterItem | null {
	const parts = value.split("|");
	if (parts.length !== 2) return null;

	const values = parts[0].split(",").filter(Boolean);
	const isNot = parts[1] === "1";

	if (values.length === 0) return null;

	return { values, isNot };
}

function serializeFilterItem(item: FilterItem): string {
	return `${item.values.join(",")}|${item.isNot ? "1" : "0"}`;
}

const parseAsFilterItem = createParser({
	parse(value: string) {
		const parsed = parseFilterItem(value);
		if (!parsed) return null;
		return parsed;
	},
	serialize(item: FilterItem) {
		return serializeFilterItem(item);
	},
});

const parseAsFilterItems = parseAsNativeArrayOf(parseAsFilterItem);

function coerceFilterItem(
	item: FilterItem,
	allowed: readonly string[],
): FilterItem | null {
	const allowedSet = new Set<string>(allowed);
	const filtered = item.values.filter((value) => allowedSet.has(value));
	if (filtered.length === 0) return null;
	return { values: filtered, isNot: item.isNot };
}

function createEnumFilterItemParser(allowed: readonly string[]) {
	return createParser<FilterItem | null>({
		parse(value: string) {
			const parsed = parseFilterItem(value);
			if (!parsed) return null;
			return coerceFilterItem(parsed, allowed);
		},
		serialize(item) {
			if (!item) return "";
			return serializeFilterItem(item);
		},
	});
}

const parseAsTaskStatusFilterItems = parseAsNativeArrayOf(
	createEnumFilterItemParser(TASK_STATUSES),
);
const parseAsTaskPriorityFilterItems = parseAsNativeArrayOf(
	createEnumFilterItemParser(TASK_PRIORITIES),
);
const parseAsTaskParentTypeFilterItems = parseAsNativeArrayOf(
	createEnumFilterItemParser(TASK_PARENT_TYPES),
);
const parseAsCompetitionPhaseFilterItems = parseAsNativeArrayOf(
	createEnumFilterItemParser(COMPETITION_PHASE_KEYS),
);

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
	status: parseAsTaskStatusFilterItems,
	priority: parseAsTaskPriorityFilterItems,
	assignee: parseAsFilterItems,
	labels: parseAsFilterItems,
	owner: parseAsFilterItems,
	parentType: parseAsTaskParentTypeFilterItems,
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
	phase: parseAsCompetitionPhaseFilterItems,
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

export function normalizeFilterItems(
	items: Array<FilterItem | null> | null | undefined,
): FilterItem[] {
	return (items ?? []).filter((item): item is FilterItem => item != null);
}

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
	dateIsNot: "0" | "1" | null;
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
