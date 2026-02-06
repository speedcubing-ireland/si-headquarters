import { describe, expect, test } from "vitest";
import {
	matchesTaskViewFilters,
	matchesCompetitionViewFilters,
} from "./notificationViewMatchers";

const makeTaskRecord = (overrides = {}) => ({
	status: "in-progress",
	priority: "medium",
	assigneeIds: ["user1"],
	labelIds: ["label1"],
	ownerIds: ["owner1"],
	parentTypes: ["competition"],
	dueDate: "2025-06-15",
	...overrides,
});

const makeCompRecord = (overrides = {}) => ({
	phaseKeys: ["planning"],
	compLeadRefs: ["lead1"],
	leadDelegateRefs: ["delegate1"],
	organiserRefs: ["org1", "org2"],
	compStart: "2025-06-01",
	compEnd: "2025-06-03",
	...overrides,
});

function buildFilters(
	filters: Record<string, unknown>,
	matchMode: "any" | "all" = "all",
): string {
	return JSON.stringify({ filters, matchMode });
}

describe("matchesTaskViewFilters", () => {
	describe("basic matching", () => {
		test("returns true for empty filters JSON", () => {
			const record = makeTaskRecord();
			expect(matchesTaskViewFilters(record, "{}")).toBe(true);
		});

		test("returns true for invalid JSON", () => {
			const record = makeTaskRecord();
			expect(matchesTaskViewFilters(record, "not json")).toBe(true);
		});

		test("returns true when all filter arrays are empty", () => {
			const record = makeTaskRecord();
			const filters = buildFilters({
				status: [],
				priority: [],
				assignee: [],
				labels: [],
				owner: [],
				parentType: [],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});
	});

	describe("single filter matching", () => {
		test("matches status filter", () => {
			const record = makeTaskRecord({ status: "in-progress" });
			const filters = buildFilters({
				status: [{ values: ["in-progress"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when status does not match", () => {
			const record = makeTaskRecord({ status: "done" });
			const filters = buildFilters({
				status: [{ values: ["in-progress"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("matches priority filter", () => {
			const record = makeTaskRecord({ priority: "high" });
			const filters = buildFilters({
				priority: [{ values: ["high", "urgent"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("matches assignee filter with multiple assignees", () => {
			const record = makeTaskRecord({ assigneeIds: ["user1", "user2"] });
			const filters = buildFilters({
				assignee: [{ values: ["user2"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when assignee does not match", () => {
			const record = makeTaskRecord({ assigneeIds: ["user1"] });
			const filters = buildFilters({
				assignee: [{ values: ["user999"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("matches labels filter", () => {
			const record = makeTaskRecord({
				labelIds: ["label1", "label2", "label3"],
			});
			const filters = buildFilters({
				labels: [{ values: ["label2"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});
	});

	describe("negation (isNot)", () => {
		test("excludes matching items when isNot is true", () => {
			const record = makeTaskRecord({ status: "done" });
			const filters = buildFilters({
				status: [{ values: ["done"], isNot: true }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("includes non-matching items when isNot is true", () => {
			const record = makeTaskRecord({ status: "in-progress" });
			const filters = buildFilters({
				status: [{ values: ["done"], isNot: true }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("combines positive and negative filters", () => {
			const record = makeTaskRecord({
				status: "in-progress",
				priority: "high",
			});
			const filters = buildFilters({
				status: [{ values: ["in-progress"], isNot: false }],
				priority: [{ values: ["low"], isNot: true }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when negative filter matches", () => {
			const record = makeTaskRecord({
				status: "in-progress",
				priority: "low",
			});
			const filters = buildFilters({
				priority: [{ values: ["low"], isNot: true }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});
	});

	describe("matchMode: any", () => {
		test("matches when any one filter matches", () => {
			const record = makeTaskRecord({
				status: "done",
				priority: "high",
			});
			const filters = buildFilters(
				{
					status: [{ values: ["in-progress"], isNot: false }],
					priority: [{ values: ["high"], isNot: false }],
				},
				"any",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when no filter matches in any mode", () => {
			const record = makeTaskRecord({
				status: "done",
				priority: "low",
			});
			const filters = buildFilters(
				{
					status: [{ values: ["in-progress"], isNot: false }],
					priority: [{ values: ["high"], isNot: false }],
				},
				"any",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});
	});

	describe("matchMode: all", () => {
		test("matches when all filters match", () => {
			const record = makeTaskRecord({
				status: "in-progress",
				priority: "high",
			});
			const filters = buildFilters(
				{
					status: [{ values: ["in-progress"], isNot: false }],
					priority: [{ values: ["high"], isNot: false }],
				},
				"all",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when one filter does not match in all mode", () => {
			const record = makeTaskRecord({
				status: "in-progress",
				priority: "low",
			});
			const filters = buildFilters(
				{
					status: [{ values: ["in-progress"], isNot: false }],
					priority: [{ values: ["high"], isNot: false }],
				},
				"all",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});
	});

	describe("date range filtering", () => {
		test("matches task within date range", () => {
			const record = makeTaskRecord({ dueDate: "2025-06-15" });
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-30" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects task outside date range", () => {
			const record = makeTaskRecord({ dueDate: "2025-07-15" });
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-30" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("matches with only start date", () => {
			const record = makeTaskRecord({ dueDate: "2025-06-15" });
			const filters = buildFilters({
				dateRange: { start: "2025-06-01" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects with only start date when before range", () => {
			const record = makeTaskRecord({ dueDate: "2025-05-15" });
			const filters = buildFilters({
				dateRange: { start: "2025-06-01" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("matches with only end date", () => {
			const record = makeTaskRecord({ dueDate: "2025-06-15" });
			const filters = buildFilters({
				dateRange: { end: "2025-06-30" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("negates date range with isNot", () => {
			const record = makeTaskRecord({ dueDate: "2025-06-15" });
			const filters = buildFilters({
				dateRange: {
					start: "2025-06-01",
					end: "2025-06-30",
					isNot: true,
				},
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});

		test("returns true for task outside negated date range", () => {
			const record = makeTaskRecord({ dueDate: "2025-07-15" });
			const filters = buildFilters({
				dateRange: {
					start: "2025-06-01",
					end: "2025-06-30",
					isNot: true,
				},
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects task with no due date when date range is specified", () => {
			const record = makeTaskRecord({ dueDate: undefined });
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-30" },
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});
	});

	describe("multiple filter items on same field", () => {
		test("matches when any positive item matches in any mode", () => {
			const record = makeTaskRecord({ status: "done" });
			const filters = buildFilters(
				{
					status: [
						{ values: ["in-progress"], isNot: false },
						{ values: ["done"], isNot: false },
					],
				},
				"any",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("requires all positive items to match in all mode", () => {
			const record = makeTaskRecord({
				labelIds: ["label1", "label2"],
			});
			const filters = buildFilters(
				{
					labels: [
						{ values: ["label1"], isNot: false },
						{ values: ["label2"], isNot: false },
					],
				},
				"all",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("rejects when not all positive items match in all mode", () => {
			const record = makeTaskRecord({ labelIds: ["label1"] });
			const filters = buildFilters(
				{
					labels: [
						{ values: ["label1"], isNot: false },
						{ values: ["label2"], isNot: false },
					],
				},
				"all",
			);
			expect(matchesTaskViewFilters(record, filters)).toBe(false);
		});
	});

	describe("owner and parentType filters", () => {
		test("matches owner filter", () => {
			const record = makeTaskRecord({ ownerIds: ["team1"] });
			const filters = buildFilters({
				owner: [{ values: ["team1"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});

		test("matches parentType filter", () => {
			const record = makeTaskRecord({ parentTypes: ["competition"] });
			const filters = buildFilters({
				parentType: [{ values: ["competition"], isNot: false }],
			});
			expect(matchesTaskViewFilters(record, filters)).toBe(true);
		});
	});
});

describe("matchesCompetitionViewFilters", () => {
	describe("basic matching", () => {
		test("returns true for empty filters", () => {
			const record = makeCompRecord();
			expect(matchesCompetitionViewFilters(record, "{}")).toBe(true);
		});

		test("returns true for invalid JSON", () => {
			const record = makeCompRecord();
			expect(matchesCompetitionViewFilters(record, "bad json")).toBe(true);
		});
	});

	describe("single filter matching", () => {
		test("matches phase filter", () => {
			const record = makeCompRecord({ phaseKeys: ["planning"] });
			const filters = buildFilters({
				phase: [{ values: ["planning"], isNot: false }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("rejects when phase does not match", () => {
			const record = makeCompRecord({ phaseKeys: ["completed"] });
			const filters = buildFilters({
				phase: [{ values: ["planning"], isNot: false }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});

		test("matches compLead filter", () => {
			const record = makeCompRecord({ compLeadRefs: ["lead1"] });
			const filters = buildFilters({
				compLead: [{ values: ["lead1"], isNot: false }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("matches leadDelegate filter", () => {
			const record = makeCompRecord({ leadDelegateRefs: ["delegate1"] });
			const filters = buildFilters({
				leadDelegate: [{ values: ["delegate1"], isNot: false }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("matches organisers filter", () => {
			const record = makeCompRecord({ organiserRefs: ["org1", "org2"] });
			const filters = buildFilters({
				organisers: [{ values: ["org2"], isNot: false }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});
	});

	describe("negation", () => {
		test("excludes matching phase when isNot is true", () => {
			const record = makeCompRecord({ phaseKeys: ["completed"] });
			const filters = buildFilters({
				phase: [{ values: ["completed"], isNot: true }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});

		test("includes non-matching phase when isNot is true", () => {
			const record = makeCompRecord({ phaseKeys: ["planning"] });
			const filters = buildFilters({
				phase: [{ values: ["completed"], isNot: true }],
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});
	});

	describe("competition date range filtering", () => {
		test("matches when competition overlaps with date range", () => {
			const record = makeCompRecord({
				compStart: "2025-06-01",
				compEnd: "2025-06-03",
			});
			const filters = buildFilters({
				dateRange: { start: "2025-05-15", end: "2025-06-15" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("matches partial overlap (competition starts before range ends)", () => {
			const record = makeCompRecord({
				compStart: "2025-06-14",
				compEnd: "2025-06-16",
			});
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-15" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("rejects when competition is entirely outside date range", () => {
			const record = makeCompRecord({
				compStart: "2025-07-01",
				compEnd: "2025-07-03",
			});
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-30" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});

		test("matches with only start date when competition ends after start", () => {
			const record = makeCompRecord({
				compStart: "2025-06-01",
				compEnd: "2025-06-03",
			});
			const filters = buildFilters({
				dateRange: { start: "2025-05-01" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("rejects with only start date when competition ends before start", () => {
			const record = makeCompRecord({
				compStart: "2025-04-01",
				compEnd: "2025-04-03",
			});
			const filters = buildFilters({
				dateRange: { start: "2025-05-01" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});

		test("matches with only end date when competition starts before end", () => {
			const record = makeCompRecord({
				compStart: "2025-06-01",
				compEnd: "2025-06-03",
			});
			const filters = buildFilters({
				dateRange: { end: "2025-06-30" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("negates competition date range with isNot", () => {
			const record = makeCompRecord({
				compStart: "2025-06-01",
				compEnd: "2025-06-03",
			});
			const filters = buildFilters({
				dateRange: {
					start: "2025-05-15",
					end: "2025-06-15",
					isNot: true,
				},
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});

		test("returns false when compStart or compEnd is missing", () => {
			const record = makeCompRecord({
				compStart: undefined,
				compEnd: undefined,
			});
			const filters = buildFilters({
				dateRange: { start: "2025-06-01", end: "2025-06-30" },
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});
	});

	describe("matchMode: any", () => {
		test("matches when any one filter matches", () => {
			const record = makeCompRecord({
				phaseKeys: ["completed"],
				compLeadRefs: ["lead1"],
			});
			const filters = buildFilters(
				{
					phase: [{ values: ["planning"], isNot: false }],
					compLead: [{ values: ["lead1"], isNot: false }],
				},
				"any",
			);
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});
	});

	describe("matchMode: all", () => {
		test("requires all filters to match", () => {
			const record = makeCompRecord({
				phaseKeys: ["planning"],
				compLeadRefs: ["lead1"],
			});
			const filters = buildFilters(
				{
					phase: [{ values: ["planning"], isNot: false }],
					compLead: [{ values: ["lead1"], isNot: false }],
				},
				"all",
			);
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("rejects when not all filters match", () => {
			const record = makeCompRecord({
				phaseKeys: ["planning"],
				compLeadRefs: ["lead2"],
			});
			const filters = buildFilters(
				{
					phase: [{ values: ["planning"], isNot: false }],
					compLead: [{ values: ["lead1"], isNot: false }],
				},
				"all",
			);
			expect(matchesCompetitionViewFilters(record, filters)).toBe(false);
		});
	});

	describe("input normalization", () => {
		test("treats non-array values as empty filter items", () => {
			const record = makeCompRecord();
			const filters = JSON.stringify({
				filters: { phase: "not an array" },
				matchMode: "all",
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("skips filter items with empty values arrays", () => {
			const record = makeCompRecord();
			const filters = JSON.stringify({
				filters: {
					phase: [{ values: [], isNot: false }],
				},
				matchMode: "all",
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});

		test("skips filter items that are not objects", () => {
			const record = makeCompRecord();
			const filters = JSON.stringify({
				filters: {
					phase: ["not an object", 42, null],
				},
				matchMode: "all",
			});
			expect(matchesCompetitionViewFilters(record, filters)).toBe(true);
		});
	});
});
