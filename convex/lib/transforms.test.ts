import { describe, expect, test } from "vitest";
import {
	createLens,
	toUser,
	toLabel,
	toPhase,
	toUsers,
	toLabels,
	toPhases,
	toUserMap,
	toLabelMap,
	toPhaseMap,
	extractMemberIds,
	buildTeamsWithMembers,
	toISO,
} from "./transforms";
import type { Id } from "../_generated/dataModel";

const userId = (id: string) => id as Id<"users">;
const labelId = (id: string) => id as Id<"labels">;
const phaseId = (id: string) => id as Id<"phases">;
const teamId = (id: string) => id as Id<"teams">;

describe("createLens", () => {
	test("gets an item by id", () => {
		const lens = createLens([
			{ id: "a", name: "Alice" },
			{ id: "b", name: "Bob" },
		]);
		expect(lens.get("a")).toEqual({ id: "a", name: "Alice" });
		expect(lens.get("b")).toEqual({ id: "b", name: "Bob" });
	});

	test("returns undefined for non-existent id", () => {
		const lens = createLens([{ id: "a", name: "Alice" }]);
		expect(lens.get("z")).toBeUndefined();
	});

	test("getAll returns items in order", () => {
		const lens = createLens([
			{ id: "a", name: "Alice" },
			{ id: "b", name: "Bob" },
			{ id: "c", name: "Charlie" },
		]);
		const result = lens.getAll(["c", "a"]);
		expect(result).toEqual([
			{ id: "c", name: "Charlie" },
			{ id: "a", name: "Alice" },
		]);
	});

	test("getAll returns undefined for missing items", () => {
		const lens = createLens([{ id: "a", name: "Alice" }]);
		const result = lens.getAll(["a", "z"]);
		expect(result).toEqual([{ id: "a", name: "Alice" }, undefined]);
	});

	test("handles empty list", () => {
		const lens = createLens<{ id: string; name: string }>([]);
		expect(lens.get("a")).toBeUndefined();
		expect(lens.getAll([])).toEqual([]);
	});

	test("handles duplicate IDs (last wins)", () => {
		const lens = createLens([
			{ id: "a", name: "First" },
			{ id: "a", name: "Second" },
		]);
		expect(lens.get("a")?.name).toBe("Second");
	});
});

describe("toUser", () => {
	test("transforms user doc to UI shape", () => {
		const doc = {
			_id: userId("u1"),
			_creationTime: 1000,
			name: "Alice",
			image: "https://example.com/alice.png",
		};
		const result = toUser(doc as never);
		expect(result).toEqual({
			id: userId("u1"),
			name: "Alice",
			avatarUrl: "https://example.com/alice.png",
		});
	});

	test("handles null name and image", () => {
		const doc = {
			_id: userId("u2"),
			_creationTime: 1000,
			name: null,
			image: null,
		};
		const result = toUser(doc as never);
		expect(result).toEqual({
			id: userId("u2"),
			name: "",
			avatarUrl: "",
		});
	});
});

describe("toLabel", () => {
	test("transforms label doc to UI shape", () => {
		const doc = {
			_id: labelId("l1"),
			_creationTime: 1000,
			name: "Bug",
			color: "#ff0000",
		};
		const result = toLabel(doc as never);
		expect(result).toEqual({
			id: labelId("l1"),
			name: "Bug",
			color: "#ff0000",
		});
	});
});

describe("toPhase", () => {
	test("transforms phase doc to UI shape", () => {
		const doc = {
			_id: phaseId("p1"),
			_creationTime: 1000,
			name: "Planning",
			description: "Initial planning phase",
		};
		const result = toPhase(doc as never);
		expect(result).toEqual({
			id: phaseId("p1"),
			name: "Planning",
			description: "Initial planning phase",
		});
	});
});

describe("toUsers / toLabels / toPhases (batch with null filtering)", () => {
	test("toUsers filters out null docs", () => {
		const docs = [
			{
				_id: userId("u1"),
				_creationTime: 1000,
				name: "Alice",
				image: "img1",
			},
			null,
			{
				_id: userId("u2"),
				_creationTime: 1000,
				name: "Bob",
				image: "img2",
			},
		];
		const result = toUsers(docs as never);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Alice");
		expect(result[1].name).toBe("Bob");
	});

	test("toLabels filters out null docs", () => {
		const docs = [
			null,
			{
				_id: labelId("l1"),
				_creationTime: 1000,
				name: "Bug",
				color: "red",
			},
		];
		const result = toLabels(docs as never);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Bug");
	});

	test("toPhases filters out null docs", () => {
		const docs = [
			{
				_id: phaseId("p1"),
				_creationTime: 1000,
				name: "Alpha",
				description: "a",
			},
			null,
		];
		const result = toPhases(docs as never);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alpha");
	});
});

describe("toUserMap / toLabelMap / toPhaseMap", () => {
	test("toUserMap creates a map keyed by user ID", () => {
		const ids = [userId("u1"), userId("u2")];
		const docs = [
			{
				_id: userId("u1"),
				_creationTime: 1000,
				name: "Alice",
				image: "img1",
			},
			{
				_id: userId("u2"),
				_creationTime: 1000,
				name: "Bob",
				image: "img2",
			},
		];
		const map = toUserMap(ids, docs as never);
		expect(map.size).toBe(2);
		expect(map.get(userId("u1"))?.name).toBe("Alice");
		expect(map.get(userId("u2"))?.name).toBe("Bob");
	});

	test("toLabelMap creates a map keyed by label ID", () => {
		const ids = [labelId("l1")];
		const docs = [
			{
				_id: labelId("l1"),
				_creationTime: 1000,
				name: "Bug",
				color: "red",
			},
		];
		const map = toLabelMap(ids, docs as never);
		expect(map.get(labelId("l1"))?.name).toBe("Bug");
	});

	test("toPhaseMap creates a map keyed by phase ID", () => {
		const ids = [phaseId("p1")];
		const docs = [
			{
				_id: phaseId("p1"),
				_creationTime: 1000,
				name: "Prep",
				description: "Preparation phase",
			},
		];
		const map = toPhaseMap(ids, docs as never);
		expect(map.get(phaseId("p1"))?.name).toBe("Prep");
	});
});

describe("extractMemberIds", () => {
	test("extracts unique member IDs from teams", () => {
		const teamDocs = [
			{
				_id: teamId("t1"),
				name: "Team1",
				memberIds: [userId("u1"), userId("u2")],
			},
			{
				_id: teamId("t2"),
				name: "Team2",
				memberIds: [userId("u2"), userId("u3")],
			},
		];
		const result = extractMemberIds(teamDocs as never);
		expect(result.size).toBe(3);
		expect(result.has(userId("u1"))).toBe(true);
		expect(result.has(userId("u2"))).toBe(true);
		expect(result.has(userId("u3"))).toBe(true);
	});

	test("handles null team docs", () => {
		const teamDocs = [
			null,
			{
				_id: teamId("t1"),
				name: "Team1",
				memberIds: [userId("u1")],
			},
			null,
		];
		const result = extractMemberIds(teamDocs as never);
		expect(result.size).toBe(1);
		expect(result.has(userId("u1"))).toBe(true);
	});

	test("returns empty set for empty array", () => {
		const result = extractMemberIds([]);
		expect(result.size).toBe(0);
	});

	test("returns empty set for all null array", () => {
		const result = extractMemberIds([null, null] as never);
		expect(result.size).toBe(0);
	});
});

describe("buildTeamsWithMembers", () => {
	test("builds team map with resolved members", () => {
		const ids = [teamId("t1")];
		const teamDocs = [
			{
				_id: teamId("t1"),
				name: "Directors",
				memberIds: [userId("u1"), userId("u2")],
			},
		];
		const memberMap = new Map([
			[userId("u1"), { id: userId("u1"), name: "Alice", avatarUrl: "a" }],
			[userId("u2"), { id: userId("u2"), name: "Bob", avatarUrl: "b" }],
		]);

		const result = buildTeamsWithMembers(ids, teamDocs as never, memberMap);
		expect(result.size).toBe(1);
		const team = result.get(teamId("t1"));
		expect(team?.name).toBe("Directors");
		expect(team?.members).toHaveLength(2);
		expect(team?.members[0].name).toBe("Alice");
	});

	test("filters out members not in member map", () => {
		const ids = [teamId("t1")];
		const teamDocs = [
			{
				_id: teamId("t1"),
				name: "Team",
				memberIds: [userId("u1"), userId("u99")],
			},
		];
		const memberMap = new Map([
			[userId("u1"), { id: userId("u1"), name: "Alice", avatarUrl: "a" }],
		]);

		const result = buildTeamsWithMembers(ids, teamDocs as never, memberMap);
		const team = result.get(teamId("t1"));
		expect(team?.members).toHaveLength(1);
		expect(team?.members[0].name).toBe("Alice");
	});

	test("skips null team docs", () => {
		const ids = [teamId("t1"), teamId("t2")];
		const teamDocs = [
			{
				_id: teamId("t1"),
				name: "Team1",
				memberIds: [userId("u1")],
			},
			null,
		];
		const memberMap = new Map([
			[userId("u1"), { id: userId("u1"), name: "Alice", avatarUrl: "a" }],
		]);

		const result = buildTeamsWithMembers(ids, teamDocs as never, memberMap);
		expect(result.size).toBe(1);
		expect(result.has(teamId("t1"))).toBe(true);
		expect(result.has(teamId("t2"))).toBe(false);
	});

	test("handles empty inputs", () => {
		const result = buildTeamsWithMembers([], [], new Map());
		expect(result.size).toBe(0);
	});
});

describe("toISO", () => {
	test("converts timestamp to ISO string", () => {
		const ms = new Date("2025-06-15T12:00:00Z").getTime();
		expect(toISO(ms)).toBe("2025-06-15T12:00:00.000Z");
	});

	test("converts epoch zero", () => {
		expect(toISO(0)).toBe("1970-01-01T00:00:00.000Z");
	});
});
