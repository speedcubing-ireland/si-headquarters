import { describe, expect, test } from "vitest";
import {
	encodeApprovalId,
	decodeApprovalId,
	computeApprovalCompleteness,
	resolveApprovalData,
} from "./taskApprovals";
import type { Id } from "./_generated/dataModel";

const userId = (id: string) => id as Id<"users">;
const teamId = (id: string) => id as Id<"teams">;

describe("encodeApprovalId", () => {
	test("encodes user id with user: prefix", () => {
		const result = encodeApprovalId("user", userId("abc123"));
		expect(result).toBe("user:abc123");
	});

	test("encodes team id with team: prefix", () => {
		const result = encodeApprovalId("team", teamId("team456"));
		expect(result).toBe("team:team456");
	});

	test("preserves the full ID string", () => {
		const longId = "k17cjy3bz8r9f2wqxnv05gdm4s6pa1et";
		const result = encodeApprovalId("user", userId(longId));
		expect(result).toBe(`user:${longId}`);
	});
});

describe("decodeApprovalId", () => {
	test("decodes user-prefixed string", () => {
		const result = decodeApprovalId("user:abc123");
		expect(result).toEqual({ type: "user", id: "abc123" });
	});

	test("decodes team-prefixed string", () => {
		const result = decodeApprovalId("team:team456");
		expect(result).toEqual({ type: "team", id: "team456" });
	});

	test("returns null for unknown prefix", () => {
		expect(decodeApprovalId("admin:abc")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(decodeApprovalId("")).toBeNull();
	});

	test("returns null for string without prefix", () => {
		expect(decodeApprovalId("abc123")).toBeNull();
	});

	test("handles colons in the ID portion", () => {
		const result = decodeApprovalId("user:id:with:colons");
		expect(result).toEqual({ type: "user", id: "id:with:colons" });
	});

	test("roundtrip encode-decode for user", () => {
		const id = userId("user123");
		const encoded = encodeApprovalId("user", id);
		const decoded = decodeApprovalId(encoded);
		expect(decoded).toEqual({ type: "user", id: "user123" });
	});

	test("roundtrip encode-decode for team", () => {
		const id = teamId("team789");
		const encoded = encodeApprovalId("team", id);
		const decoded = decodeApprovalId(encoded);
		expect(decoded).toEqual({ type: "team", id: "team789" });
	});
});

describe("computeApprovalCompleteness", () => {
	function makeMockCtx(teams: Record<string, { memberIds: string[] }>) {
		return {
			db: {
				get: async (_table: string, id: string) => {
					const team = teams[id];
					if (team) {
						return { _id: id, name: `Team ${id}`, memberIds: team.memberIds };
					}
					return null;
				},
			},
		} as never;
	}

	test("returns fully approved for empty required list", async () => {
		const result = await computeApprovalCompleteness(makeMockCtx({}), [], []);
		expect(result.isFullyApproved).toBe(true);
		expect(result.pendingKeys).toEqual([]);
	});

	test("returns not approved when user has not approved", async () => {
		const result = await computeApprovalCompleteness(
			makeMockCtx({}),
			["user:u1"],
			[],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("user:u1");
	});

	test("returns fully approved when user has approved", async () => {
		const result = await computeApprovalCompleteness(
			makeMockCtx({}),
			["user:u1"],
			["u1" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(true);
		expect(result.pendingKeys).toEqual([]);
	});

	test("handles multiple required users", async () => {
		const result = await computeApprovalCompleteness(
			makeMockCtx({}),
			["user:u1", "user:u2"],
			["u1" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("user:u2");
		expect(result.pendingKeys).not.toContain("user:u1");
	});

	test("team approval satisfied when any member approves", async () => {
		const ctx = makeMockCtx({ t1: { memberIds: ["memberA", "memberB"] } });
		const result = await computeApprovalCompleteness(
			ctx,
			["team:t1"],
			["memberA" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(true);
		expect(result.pendingKeys).toEqual([]);
	});

	test("team approval not satisfied when no member has approved", async () => {
		const ctx = makeMockCtx({ t1: { memberIds: ["memberA", "memberB"] } });
		const result = await computeApprovalCompleteness(
			ctx,
			["team:t1"],
			["unrelatedUser" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("team:t1");
	});

	test("missing team is treated as pending", async () => {
		const result = await computeApprovalCompleteness(
			makeMockCtx({}),
			["team:nonexistent"],
			[],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("team:nonexistent");
	});

	test("invalid approval IDs are treated as pending", async () => {
		const result = await computeApprovalCompleteness(
			makeMockCtx({}),
			["invalid:x"],
			[],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("invalid:x");
	});

	test("mixed user and team approvals", async () => {
		const ctx = makeMockCtx({ t1: { memberIds: ["memberA", "memberB"] } });
		const result = await computeApprovalCompleteness(
			ctx,
			["user:u1", "team:t1"],
			["u1" as Id<"users">, "memberB" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(true);
		expect(result.pendingKeys).toEqual([]);
	});

	test("mixed user and team - partial approval", async () => {
		const ctx = makeMockCtx({ t1: { memberIds: ["memberA", "memberB"] } });
		const result = await computeApprovalCompleteness(
			ctx,
			["user:u1", "team:t1"],
			["u1" as Id<"users">],
		);
		expect(result.isFullyApproved).toBe(false);
		expect(result.pendingKeys).toContain("team:t1");
	});
});

describe("resolveApprovalData", () => {
	const mockCtx = { db: { get: async () => null } } as never;

	test("resolves user approvals from maps", () => {
		const usersMap = new Map([
			[userId("u1"), { id: userId("u1"), name: "Alice", avatarUrl: "img1" }],
			[userId("u2"), { id: userId("u2"), name: "Bob", avatarUrl: "img2" }],
		]);
		const teamsMap = new Map();

		const result = resolveApprovalData(
			mockCtx,
			["user:u1", "user:u2"],
			[userId("u1")],
			usersMap,
			teamsMap,
		);

		expect(result.requiredApprovalBy).toHaveLength(2);
		expect(result.approvedBy).toHaveLength(1);
		expect(result.approvedBy[0].name).toBe("Alice");
	});

	test("resolves team approvals from maps", () => {
		const usersMap = new Map([
			[userId("u1"), { id: userId("u1"), name: "Alice", avatarUrl: "img1" }],
		]);
		const teamsMap = new Map([
			[
				teamId("t1"),
				{
					id: teamId("t1"),
					name: "Team Alpha",
					members: [{ id: userId("u1"), name: "Alice", avatarUrl: "img1" }],
				},
			],
		]);

		const result = resolveApprovalData(
			mockCtx,
			["team:t1"],
			[],
			usersMap,
			teamsMap,
		);

		expect(result.requiredApprovalBy).toHaveLength(1);
		expect((result.requiredApprovalBy[0] as { name: string }).name).toBe(
			"Team Alpha",
		);
	});

	test("skips unresolvable IDs", () => {
		const usersMap = new Map();
		const teamsMap = new Map();

		const result = resolveApprovalData(
			mockCtx,
			["user:unknown", "invalid:x"],
			[],
			usersMap,
			teamsMap,
		);

		expect(result.requiredApprovalBy).toHaveLength(0);
		expect(result.approvedBy).toHaveLength(0);
	});
});
