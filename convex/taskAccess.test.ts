import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
	hasTaskCompetitionAccess,
	listOrganisedCompetitionIds,
} from "./taskAccess";

const userId = (id: string) => id as Id<"users">;
const competitionId = (id: string) => id as Id<"competitions">;

function makeCompetition(args: {
	id: string;
	organiserIds: string[];
	compLeadId?: string;
	leadDelegateId?: string;
}) {
	return {
		_id: competitionId(args.id),
		organiserIds: args.organiserIds.map((id) => userId(id)),
		compLeadId: args.compLeadId ? userId(args.compLeadId) : undefined,
		leadDelegateId: args.leadDelegateId
			? userId(args.leadDelegateId)
			: undefined,
	};
}

describe("hasTaskCompetitionAccess", () => {
	test("allows volunteers regardless of competition membership", async () => {
		const ctx = {
			db: {
				get: async () => null,
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
				get: async () => null,
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

	test("allows non-volunteers when they can access the competition", async () => {
		const competition = makeCompetition({
			id: "comp1",
			organiserIds: ["u1"],
		});
		const ctx = {
			db: {
				get: async () => competition,
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

	test("allows non-volunteers who are competition lead or lead delegate", async () => {
		const competition = makeCompetition({
			id: "comp1",
			organiserIds: [],
			compLeadId: "u1",
			leadDelegateId: "u1",
		});
		const ctx = {
			db: {
				get: async () => competition,
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

	test("denies non-volunteers without organiser/lead access", async () => {
		const competition = makeCompetition({
			id: "comp1",
			organiserIds: ["u2"],
			compLeadId: "u2",
			leadDelegateId: "u3",
		});
		const ctx = {
			db: {
				get: async () => competition,
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
		const competitions = [
			makeCompetition({
				id: "organiser-comp",
				organiserIds: ["u1"],
			}),
			makeCompetition({
				id: "lead-only-comp",
				organiserIds: [],
				compLeadId: "u1",
			}),
		];
		const ctx = {
			db: {
				query: () => ({
					collect: async () => competitions,
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
