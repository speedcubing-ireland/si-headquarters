import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedTwoTasks(t: ReturnType<typeof convexTest>): Promise<{
	userId: Id<"users">;
	subscriberId: Id<"users">;
	competitionId: Id<"competitions">;
	taskAId: Id<"tasks">;
	taskBId: Id<"tasks">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const subscriberId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId, subscriberId],
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
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: subscriberId,
		});
		const taskAId = await ctx.db.insert("tasks", {
			identifier: "HQ-300",
			title: "Task A",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		const taskBId = await ctx.db.insert("tasks", {
			identifier: "HQ-301",
			title: "Task B",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		return { userId, subscriberId, competitionId, taskAId, taskBId };
	});
}

async function linkDiscordUser(
	t: ReturnType<typeof convexTest>,
	userId: Id<"users">,
) {
	await t.run((ctx) =>
		ctx.db.insert("discordUserLinks", {
			userId,
			guildId: "guild-1",
			discordUserId: `discord-${userId}`,
			discordUsername: "linked-user",
			linkedById: userId,
			linkedAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
}

describe("task blocking relations behavior", () => {
	test("addBlockingRelation creates a taskRelation record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTwoTasks(t);
		await linkDiscordUser(t, seeded.subscriberId);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.relations.addBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});

		const relations = await t.run((ctx) =>
			ctx.db.query("taskRelations").collect(),
		);
		const rel = relations.find(
			(r) =>
				r.blockedTaskId === seeded.taskBId &&
				r.blockingTaskId === seeded.taskAId,
		);
		expect(rel).toBeTruthy();
	});

	test("addBlockingRelation sends relation_blocked notification", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTwoTasks(t);
		await linkDiscordUser(t, seeded.subscriberId);
		const authed = t.withIdentity({ subject: seeded.userId });

		// Subscribe a different user (not actor) to blocked task
		await t.run(async (ctx) => {
			await ctx.db.insert("notificationSubscriptions", {
				userId: seeded.subscriberId,
				entityType: "task",
				entityId: `${seeded.taskBId}`,
				updatedAt: Date.now(),
			});
		});

		await authed.mutation(api.tasks.relations.addBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});
		const notifications = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		expect(
			notifications.some((token) => token.userId === seeded.subscriberId),
		).toBeTruthy();
	}, 15_000);

	test("removeBlockingRelation deletes the taskRelation record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTwoTasks(t);
		await linkDiscordUser(t, seeded.subscriberId);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.relations.addBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await authed.mutation(api.tasks.relations.removeBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});

		const relations = await t.run((ctx) =>
			ctx.db.query("taskRelations").collect(),
		);
		expect(relations).toHaveLength(0);
	}, 15_000);

	test("removeBlockingRelation sends relation_unblocked notification", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTwoTasks(t);
		await linkDiscordUser(t, seeded.subscriberId);
		const authed = t.withIdentity({ subject: seeded.userId });

		// Subscribe a different user (not actor) to blocked task
		await t.run(async (ctx) => {
			await ctx.db.insert("notificationSubscriptions", {
				userId: seeded.subscriberId,
				entityType: "task",
				entityId: `${seeded.taskBId}`,
				updatedAt: Date.now(),
			});
		});

		await authed.mutation(api.tasks.relations.addBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});
		await authed.mutation(api.tasks.relations.removeBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		expect(
			notifications.some((token) => token.userId === seeded.subscriberId),
		).toBeTruthy();
	}, 15_000);

	test("addBlockingRelation rejects circular dependency", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTwoTasks(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.relations.addBlockingRelation, {
			blockedTaskId: seeded.taskBId,
			blockingTaskId: seeded.taskAId,
		});

		await expect(
			authed.mutation(api.tasks.relations.addBlockingRelation, {
				blockedTaskId: seeded.taskAId,
				blockingTaskId: seeded.taskBId,
			}),
		).rejects.toBeTruthy();
	});
});
