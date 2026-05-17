import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedCompetitionWithAccess(
	t: ReturnType<typeof convexTest>,
): Promise<{
	userId: Id<"users">;
	otherUserId: Id<"users">;
	competitionId: Id<"competitions">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const otherUserId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Updates Comp",
			description: "",
			compStart: "2026-05-01",
			compEnd: "2026-05-02",
			organiserIds: [userId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId,
		});
		return { userId, otherUserId, competitionId };
	});
}

describe("updates CRUD behavior", () => {
	test("create stores competitionUpdates record with correct fields", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedCompetitionWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		const updateId = await authed.mutation(api.updates.api.create, {
			competitionId,
			status: "on-track",
			message: "All good",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", updateId),
		);
		expect(doc?.competitionId).toBe(competitionId);
		expect(doc?.authorId).toBe(userId);
		expect(doc?.status).toBe("on-track");
		expect(doc?.message).toBe("All good");
		expect(doc?.reactions).toEqual([]);
	}, 15_000);

	test("create sends progress_update_added notification to subscribers", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const subscriberId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [actorId, subscriberId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Notif Comp",
				description: "",
				compStart: "2026-05-01",
				compEnd: "2026-05-02",
				organiserIds: [actorId, subscriberId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: subscriberId,
			});
			return { actorId, subscriberId, competitionId };
		});

		const authed = t.withIdentity({ subject: seeded.actorId });
		await t.run((ctx) =>
			ctx.db.insert("discordUserLinks", {
				userId: seeded.subscriberId,
				guildId: "guild-1",
				discordUserId: `discord-${seeded.subscriberId}`,
				discordUsername: "linked-user",
				linkedById: seeded.subscriberId,
				linkedAt: Date.now(),
				updatedAt: Date.now(),
			}),
		);
		await authed.mutation(api.updates.api.create, {
			competitionId: seeded.competitionId,
			status: "at-risk",
			message: "Heads up",
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		expect(
			notifications.some((token) => token.userId === seeded.subscriberId),
		).toBeTruthy();
	}, 15_000);

	test("create still schedules linked channel notification when actor is only recipient", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			await ctx.db.insert("teams", {
				name: TEAM_NAMES.VOLUNTEER,
				memberIds: [actorId],
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Channel-only Comp",
				description: "",
				compStart: "2026-05-01",
				compEnd: "2026-05-02",
				organiserIds: [actorId],
				discordChannel: {
					guildId: "guild-1",
					channelId: "channel-only-1",
					channelName: "channel-only",
				},
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			return { actorId, competitionId };
		});

		const authed = t.withIdentity({ subject: seeded.actorId });
		const updateId = await authed.mutation(api.updates.api.create, {
			competitionId: seeded.competitionId,
			status: "at-risk",
			message: "Channel should still receive this",
		});

		const tokens = await t.run((ctx) => ctx.db.query("discordActionTokens").collect());
		expect(tokens.some((token) => token.updateId === updateId)).toBeTruthy();
	}, 15_000);

	test("create rejects users without competition access", async () => {
		const t = convexTest(schema, modules);
		const { otherUserId, competitionId } = await seedCompetitionWithAccess(t);
		const denied = t.withIdentity({ subject: otherUserId });

		await expect(
			denied.mutation(api.updates.api.create, {
				competitionId,
				status: "on-track",
			}),
		).rejects.toBeTruthy();
	});

	test("update changes status and message", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedCompetitionWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		const updateId = await authed.mutation(api.updates.api.create, {
			competitionId,
			status: "on-track",
			message: "Original",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await authed.mutation(api.updates.api.update, {
			updateId,
			status: "off-track",
			message: "Changed",
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", updateId),
		);
		expect(doc?.status).toBe("off-track");
		expect(doc?.message).toBe("Changed");
	}, 15_000);

	test("remove deletes the update record", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedCompetitionWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		const updateId = await authed.mutation(api.updates.api.create, {
			competitionId,
			status: "on-track",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await authed.mutation(api.updates.api.remove, { updateId });

		const doc = await t.run((ctx) =>
			ctx.db.get("competitionUpdates", updateId),
		);
		expect(doc).toBeNull();
	}, 15_000);
});
