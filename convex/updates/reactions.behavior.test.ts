import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedCompetitionWithUpdate(
	t: ReturnType<typeof convexTest>,
): Promise<{
	userId: Id<"users">;
	competitionId: Id<"competitions">;
	updateId: Id<"competitionUpdates">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-06-01",
			compEnd: "2026-06-02",
			organiserIds: [userId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", { competitionId, userId });
		const updateId = await ctx.db.insert("competitionUpdates", {
			competitionId,
			authorId: userId,
			status: "on-track",
			message: "Everything going well",
			reactions: [],
			updatedAt: Date.now(),
		});
		return { userId, competitionId, updateId };
	});
}

describe("competition update reactions behavior", () => {
	test("addReaction adds emoji to update reactions", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionWithUpdate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.updates.api.addReaction, {
			updateId: seeded.updateId,
			emoji: "🎉",
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", seeded.updateId),
		);
		const party = doc?.reactions?.find((r) => r.emoji === "🎉");
		expect(party).toBeTruthy();
		expect(party?.userIds).toContain(seeded.userId);
	});

	test("addReaction is idempotent for same user and emoji", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionWithUpdate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.updates.api.addReaction, {
			updateId: seeded.updateId,
			emoji: "👍",
		});
		await authed.mutation(api.updates.api.addReaction, {
			updateId: seeded.updateId,
			emoji: "👍",
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", seeded.updateId),
		);
		const thumbs = doc?.reactions?.find((r) => r.emoji === "👍");
		// User should only appear once
		const count = thumbs?.userIds.filter((id) => id === seeded.userId).length;
		expect(count).toBe(1);
	});

	test("multiple users can react with same emoji", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionWithUpdate(t);

		const secondUserId = await t.run(async (ctx) => {
			const uid = await ctx.db.insert("users", {});
			await ctx.db.insert("competitionAccess", {
				competitionId: seeded.competitionId,
				userId: uid,
			});
			const teams = await ctx.db.query("teams").collect();
			const volTeam = teams.find((team) => team.name === TEAM_NAMES.VOLUNTEER);
			if (volTeam) {
				await ctx.db.patch(volTeam._id, {
					memberIds: [...volTeam.memberIds, uid],
				});
			}
			return uid;
		});

		const user1 = t.withIdentity({ subject: seeded.userId });
		const user2 = t.withIdentity({ subject: secondUserId });

		await user1.mutation(api.updates.api.addReaction, {
			updateId: seeded.updateId,
			emoji: "❤️",
		});
		await user2.mutation(api.updates.api.addReaction, {
			updateId: seeded.updateId,
			emoji: "❤️",
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", seeded.updateId),
		);
		const heart = doc?.reactions?.find((r) => r.emoji === "❤️");
		expect(heart?.userIds).toContain(seeded.userId);
		expect(heart?.userIds).toContain(secondUserId);
	});
});
