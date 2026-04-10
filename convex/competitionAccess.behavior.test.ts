import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("competition access index behavior", () => {
	test("create and update keep non-volunteer competition visibility in sync", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const volunteerId = await ctx.db.insert("users", {});
			const aliceId = await ctx.db.insert("users", {});
			const bobId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: "Volunteer",
				memberIds: [volunteerId],
			});
			await ctx.db.insert("phases", {
				key: "planning",
				name: "Planning",
				description: "Plan",
				order: 1,
				archived: false,
			});
			return { volunteerId, aliceId, bobId };
		});

		const volunteer = t.withIdentity({ subject: seeded.volunteerId });
		const alice = t.withIdentity({ subject: seeded.aliceId });
		const bob = t.withIdentity({ subject: seeded.bobId });

		const competitionId = await volunteer.mutation(api.competitions.create, {
			name: "Alice Comp",
			description: "",
			compStart: "2026-04-01",
			compEnd: "2026-04-02",
			organiserIds: [seeded.aliceId],
		});

		const aliceInitially = await alice.query(api.competitions.listForUI, {});
		const bobInitially = await bob.query(api.competitions.listForUI, {});
		expect(
			aliceInitially.map((competition: { id: string }) => competition.id),
		).toContain(competitionId);
		expect(
			bobInitially.map((competition: { id: string }) => competition.id),
		).not.toContain(competitionId);

		await alice.action(api.competitions.update, {
			competitionId,
			updates: {
				organiserIds: [seeded.bobId],
			},
		});

		const aliceAfterTransfer = await alice.query(
			api.competitions.listForUI,
			{},
		);
		const bobAfterTransfer = await bob.query(api.competitions.listForUI, {});
		expect(
			aliceAfterTransfer.map((competition: { id: string }) => competition.id),
		).not.toContain(competitionId);
		expect(
			bobAfterTransfer.map((competition: { id: string }) => competition.id),
		).toContain(competitionId);
	});
});
