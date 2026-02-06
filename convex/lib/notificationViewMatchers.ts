type MatchMode = "any" | "all";

type FilterItem = {
	values: string[];
	isNot: boolean;
};

type DateRangeFilter = {
	start?: string;
	end?: string;
	isNot?: boolean;
};

type TaskFilters = {
	status: FilterItem[];
	priority: FilterItem[];
	assignee: FilterItem[];
	labels: FilterItem[];
	owner: FilterItem[];
	parentType: FilterItem[];
	dateRange?: DateRangeFilter;
};

type CompetitionFilters = {
	phase: FilterItem[];
	compLead: FilterItem[];
	leadDelegate: FilterItem[];
	organisers: FilterItem[];
	dateRange?: DateRangeFilter;
};

type ParsedViewFilters<TFilters> = {
	filters: TFilters;
	matchMode: MatchMode;
};

type TaskMatchRecord = {
	status: string;
	priority: string;
	assigneeIds: string[];
	labelIds: string[];
	ownerIds: string[];
	parentTypes: string[];
	dueDate?: string;
};

type CompetitionMatchRecord = {
	phaseKeys: string[];
	compLeadRefs: string[];
	leadDelegateRefs: string[];
	organiserRefs: string[];
	compStart?: string;
	compEnd?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeFilterItem(value: unknown): FilterItem | null {
	if (!isRecord(value)) {
		return null;
	}

	const values = normalizeStringArray(value.values);
	if (values.length === 0) {
		return null;
	}
	return {
		values,
		isNot: value.isNot === true,
	};
}

function normalizeFilterItems(value: unknown): FilterItem[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map(normalizeFilterItem)
		.filter((item): item is FilterItem => item !== null);
}

function normalizeDateRange(value: unknown): DateRangeFilter | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const start = typeof value.start === "string" ? value.start : undefined;
	const end = typeof value.end === "string" ? value.end : undefined;
	const isNot = value.isNot === true;
	if (!start && !end && !isNot) {
		return undefined;
	}
	return {
		start,
		end,
		isNot,
	};
}

function parseViewPayload(value: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(value);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function parseTaskFilters(value: string): ParsedViewFilters<TaskFilters> {
	const fallback: ParsedViewFilters<TaskFilters> = {
		matchMode: "all",
		filters: {
			status: [],
			priority: [],
			assignee: [],
			labels: [],
			owner: [],
			parentType: [],
			dateRange: undefined,
		},
	};

	const payload = parseViewPayload(value);
	if (!payload) {
		return fallback;
	}

	const filtersNode = isRecord(payload.filters) ? payload.filters : {};
	return {
		matchMode: payload.matchMode === "any" ? "any" : "all",
		filters: {
			status: normalizeFilterItems(filtersNode.status),
			priority: normalizeFilterItems(filtersNode.priority),
			assignee: normalizeFilterItems(filtersNode.assignee),
			labels: normalizeFilterItems(filtersNode.labels),
			owner: normalizeFilterItems(filtersNode.owner),
			parentType: normalizeFilterItems(filtersNode.parentType),
			dateRange: normalizeDateRange(filtersNode.dateRange),
		},
	};
}

function parseCompetitionFilters(
	value: string,
): ParsedViewFilters<CompetitionFilters> {
	const fallback: ParsedViewFilters<CompetitionFilters> = {
		matchMode: "all",
		filters: {
			phase: [],
			compLead: [],
			leadDelegate: [],
			organisers: [],
			dateRange: undefined,
		},
	};

	const payload = parseViewPayload(value);
	if (!payload) {
		return fallback;
	}

	const filtersNode = isRecord(payload.filters) ? payload.filters : {};
	return {
		matchMode: payload.matchMode === "any" ? "any" : "all",
		filters: {
			phase: normalizeFilterItems(filtersNode.phase),
			compLead: normalizeFilterItems(filtersNode.compLead),
			leadDelegate: normalizeFilterItems(filtersNode.leadDelegate),
			organisers: normalizeFilterItems(filtersNode.organisers),
			dateRange: normalizeDateRange(filtersNode.dateRange),
		},
	};
}

function hasDateRangeValue(dateRange?: DateRangeFilter): boolean {
	return Boolean(dateRange && (dateRange.start || dateRange.end));
}

function buildFilterItemMatcher(
	filterItems: FilterItem[],
	itemValues: string[],
	matchMode: MatchMode,
): boolean {
	if (filterItems.length === 0) {
		return true;
	}

	const matchesValues = (values: string[]) =>
		itemValues.some((value) => values.includes(value));

	const positiveItems = filterItems.filter((item) => !item.isNot);
	const negativeItems = filterItems.filter((item) => item.isNot);

	const positiveMatch =
		positiveItems.length === 0
			? true
			: matchMode === "all"
				? positiveItems.every((item) => matchesValues(item.values))
				: positiveItems.some((item) => matchesValues(item.values));

	const negativeMatch = negativeItems.every(
		(item) => !matchesValues(item.values),
	);

	return positiveMatch && negativeMatch;
}

function taskDateMatches(
	dateRange: DateRangeFilter | undefined,
	taskDueDate: string | undefined,
): boolean {
	if (!hasDateRangeValue(dateRange)) {
		return true;
	}
	if (!dateRange) {
		return true;
	}

	const dueDate = taskDueDate ? new Date(taskDueDate) : null;
	const startDate = dateRange.start ? new Date(dateRange.start) : null;
	const endDate = dateRange.end ? new Date(dateRange.end) : null;

	if (!dueDate) {
		return dateRange.isNot === true;
	}

	const matches =
		(!startDate || dueDate.getTime() >= startDate.getTime()) &&
		(!endDate || dueDate.getTime() <= endDate.getTime());

	return dateRange.isNot === true ? !matches : matches;
}

function competitionDateMatches(
	dateRange: DateRangeFilter | undefined,
	compStart: string | undefined,
	compEnd: string | undefined,
): boolean {
	if (!hasDateRangeValue(dateRange)) {
		return true;
	}
	if (!dateRange || !compStart || !compEnd) {
		return false;
	}

	const compStartMs = new Date(compStart).getTime();
	const compEndMs = new Date(compEnd).getTime();

	let matches = false;
	if (dateRange.start && dateRange.end) {
		const startMs = new Date(dateRange.start).getTime();
		const endMs = new Date(dateRange.end).getTime();
		matches = compStartMs <= endMs && compEndMs >= startMs;
	} else if (dateRange.start) {
		const startMs = new Date(dateRange.start).getTime();
		matches = compEndMs >= startMs;
	} else if (dateRange.end) {
		const endMs = new Date(dateRange.end).getTime();
		matches = compStartMs <= endMs;
	}

	return dateRange.isNot === true ? !matches : matches;
}

export function matchesTaskViewFilters(
	record: TaskMatchRecord,
	filtersJson: string,
): boolean {
	const { filters, matchMode } = parseTaskFilters(filtersJson);
	const activeChecks: boolean[] = [];

	if (filters.status.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.status, [record.status], matchMode),
		);
	}
	if (filters.priority.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.priority, [record.priority], matchMode),
		);
	}
	if (filters.assignee.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.assignee, record.assigneeIds, matchMode),
		);
	}
	if (filters.labels.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.labels, record.labelIds, matchMode),
		);
	}
	if (filters.owner.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.owner, record.ownerIds, matchMode),
		);
	}
	if (filters.parentType.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.parentType, record.parentTypes, matchMode),
		);
	}
	if (hasDateRangeValue(filters.dateRange)) {
		activeChecks.push(taskDateMatches(filters.dateRange, record.dueDate));
	}

	if (activeChecks.length === 0) {
		return true;
	}
	return matchMode === "all"
		? activeChecks.every((check) => check)
		: activeChecks.some((check) => check);
}

export function matchesCompetitionViewFilters(
	record: CompetitionMatchRecord,
	filtersJson: string,
): boolean {
	const { filters, matchMode } = parseCompetitionFilters(filtersJson);
	const activeChecks: boolean[] = [];

	if (filters.phase.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.phase, record.phaseKeys, matchMode),
		);
	}
	if (filters.compLead.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(filters.compLead, record.compLeadRefs, matchMode),
		);
	}
	if (filters.leadDelegate.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(
				filters.leadDelegate,
				record.leadDelegateRefs,
				matchMode,
			),
		);
	}
	if (filters.organisers.length > 0) {
		activeChecks.push(
			buildFilterItemMatcher(
				filters.organisers,
				record.organiserRefs,
				matchMode,
			),
		);
	}
	if (hasDateRangeValue(filters.dateRange)) {
		activeChecks.push(
			competitionDateMatches(
				filters.dateRange,
				record.compStart,
				record.compEnd,
			),
		);
	}

	if (activeChecks.length === 0) {
		return true;
	}
	return matchMode === "all"
		? activeChecks.every((check) => check)
		: activeChecks.some((check) => check);
}
