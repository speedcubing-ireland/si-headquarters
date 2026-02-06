import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
	hasTaskCompetitionAccess,
	hasStandaloneTaskAccess,
	listOrganisedCompetitionIds,
} from "./taskAccess";

const userId = (id: string) => id as Id<"users">;
const competitionId = (id: string) => id as Id<"competitions">;

describe("hasTaskCompetitionAccess", () => {
	test("allows volunteers regardless of competition membership", async () => {
		const ctx = {
			db: {
				query: () => {
					throw new Error("query should not be called for volunteers");
				},
			},
		} as never;

		const result = await hasTaskCompetitionAccess(
			ctx,
			true,
			userId("u1"),
			competitionId("comp1"),
		);

		expect(result).toBe(true);
	});

	test("denies non-volunteers when competition id is missing", async () => {
		const ctx = {
			db: {
				query: () => {
					throw new Error("query should not be called when id is missing");
				},
			},
		} as never;

		const result = await hasTaskCompetitionAccess(
			ctx,
			false,
			userId("u1"),
			undefined,
		);

		expect(result).toBe(false);
	});

	test("allows non-volunteers when competitionAccess row exists", async () => {
		const ctx = {
			db: {
				query: () => ({
					withIndex: () => ({
						first: async () => ({
							competitionId: competitionId("comp1"),
							userId: userId("u1"),
						}),
					}),
				}),
			},
		} as never;

		const result = await hasTaskCompetitionAccess(
			ctx,
			false,
			userId("u1"),
			competitionId("comp1"),
		);

		expect(result).toBe(true);
	});

	test("denies non-volunteers when competitionAccess row is missing", async () => {
		const ctx = {
			db: {
				query: () => ({
					withIndex: () => ({
						first: async () => null,
					}),
				}),
			},
		} as never;

		const result = await hasTaskCompetitionAccess(
			ctx,
			false,
			userId("u1"),
			competitionId("comp1"),
		);

		expect(result).toBe(false);
	});

	test("does not fall back to competition document membership", async () => {
		const ctx = {
			db: {
				get: async () => {
					throw new Error("should not read competitions doc");
				},
				query: () => ({
					withIndex: () => ({
						first: async () => null,
					}),
				}),
			},
		} as never;

		const result = await hasTaskCompetitionAccess(
			ctx,
			false,
			userId("u1"),
			competitionId("comp1"),
		);

		expect(result).toBe(false);
	});
});

describe("listOrganisedCompetitionIds", () => {
	test("returns competitions where user has competition access", async () => {
		const accessRows = [
			{
				competitionId: competitionId("organiser-comp"),
				userId: userId("u1"),
			},
			{
				competitionId: competitionId("lead-only-comp"),
				userId: userId("u1"),
			},
		];
		const ctx = {
			db: {
				query: () => ({
					withIndex: () => ({
						collect: async () => accessRows,
					}),
				}),
			},
		} as never;

		const ids = await listOrganisedCompetitionIds(ctx, userId("u1"));

		expect(ids).toEqual([
			competitionId("organiser-comp"),
			competitionId("lead-only-comp"),
		]);
	});
});

describe("hasStandaloneTaskAccess", () => {
	test("allows access when assigned user matches", () => {
		const task = {
			parentCompetitionId: undefined,
			assigneeId: userId("u1"),
			ownerType: "user",
			ownerId: userId("u2"),
		} as never;

		expect(hasStandaloneTaskAccess(task, userId("u1"))).toBe(true);
	});

	test("allows access when owner is the user", () => {
		const task = {
			parentCompetitionId: undefined,
			assigneeId: userId("u2"),
			ownerType: "user",
			ownerId: userId("u1"),
		} as never;

		expect(hasStandaloneTaskAccess(task, userId("u1"))).toBe(true);
	});

	test("denies access for unrelated users", () => {
		const task = {
			parentCompetitionId: undefined,
			assigneeId: userId("u2"),
			ownerType: "team",
			ownerId: "team1",
		} as never;

		expect(hasStandaloneTaskAccess(task, userId("u1"))).toBe(false);
	});

	test("denies access when task belongs to a competition", () => {
		const task = {
			parentCompetitionId: competitionId("comp1"),
			assigneeId: userId("u1"),
			ownerType: "user",
			ownerId: userId("u1"),
		} as never;

		expect(hasStandaloneTaskAccess(task, userId("u1"))).toBe(false);
	});
});
