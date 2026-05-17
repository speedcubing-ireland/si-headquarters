import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedTaskWithSubscribers(
	t: ReturnType<typeof convexTest>,
): Promise<{
	actorId: Id<"users">;
	oldAssigneeId: Id<"users">;
	newAssigneeId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
}> {
	return t.run(async (ctx) => {
		const actorId = await ctx.db.insert("users", {});
		const oldAssigneeId = await ctx.db.insert("users", {});
		const newAssigneeId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [actorId, oldAssigneeId, newAssigneeId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-06-01",
			compEnd: "2026-06-02",
			organiserIds: [actorId, oldAssigneeId, newAssigneeId],
			updatedAt: Date.now(),
		});
		for (const uid of [actorId, oldAssigneeId, newAssigneeId]) {
			await ctx.db.insert("competitionAccess", { competitionId, userId: uid });
		}
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-400",
			title: "Notification Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			assigneeId: oldAssigneeId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		return { actorId, oldAssigneeId, newAssigneeId, competitionId, taskId };
	});
}

async function linkDiscordUsers(
	t: ReturnType<typeof convexTest>,
	userIds: Id<"users">[],
) {
	await t.run(async (ctx) => {
		for (const [index, userId] of userIds.entries()) {
			await ctx.db.insert("discordUserLinks", {
				userId,
				guildId: "guild-1",
				discordUserId: `discord-${index}-${userId}`,
				discordUsername: `user${index}`,
				linkedById: userId,
				linkedAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	});
}

describe("task notification behavior", () => {
	test("changing assignee sends task_assigned to new and task_unassigned to old", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		await linkDiscordUsers(t, [seeded.oldAssigneeId, seeded.newAssigneeId]);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { assigneeId: seeded.newAssigneeId },
		});
		const tokens = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		const assigned = tokens.filter(
			(token) =>
				token.taskId === seeded.taskId && token.userId === seeded.newAssigneeId,
		);
		const unassigned = tokens.filter(
			(token) =>
				token.taskId === seeded.taskId && token.userId === seeded.oldAssigneeId,
		);
		expect(assigned.length).toBeGreaterThanOrEqual(1);
		expect(unassigned.length).toBeGreaterThanOrEqual(1);
	}, 15_000);

	test("changing status sends task_status_changed to subscribers (not actor)", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		await linkDiscordUsers(t, [seeded.oldAssigneeId, seeded.newAssigneeId]);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { status: "in-progress" },
		});
		const tokens = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		const statusChanged = tokens.filter(
			(token) => token.taskId === seeded.taskId,
		);
		const actorNotified = statusChanged.filter(
			(token) => token.userId === seeded.actorId,
		);
		expect(statusChanged.length).toBeGreaterThanOrEqual(1);
		expect(actorNotified).toHaveLength(0);
	}, 15_000);

	test("changing priority sends task_priority_changed", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		await linkDiscordUsers(t, [seeded.oldAssigneeId, seeded.newAssigneeId]);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { priority: "high" },
		});
		const notifications = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		expect(
			notifications.some((token) => token.taskId === seeded.taskId),
		).toBeTruthy();
	}, 15_000);

	test("changing due date sends due_date_changed", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		await linkDiscordUsers(t, [seeded.oldAssigneeId, seeded.newAssigneeId]);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { dueDate: "2026-07-15T12:00:00.000Z" },
		});
		const notifications = await t.run((ctx) =>
			ctx.db.query("discordActionTokens").collect(),
		);
		expect(
			notifications.some((token) => token.taskId === seeded.taskId),
		).toBeTruthy();
	}, 15_000);

	test("subscribeToEntity creates notificationSubscription record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		const subId = await authed.mutation(
			api.notifications.api.subscribeToEntity,
			{
				entity: { entityType: "task", entityId: seeded.taskId },
			},
		);

		const doc = await t.run((ctx) =>
			ctx.db.get("notificationSubscriptions", subId),
		);
		expect(doc?.userId).toBe(seeded.actorId);
		expect(doc?.entityType).toBe("task");
		expect(doc?.entityId).toBe(`${seeded.taskId}`);
	});

	test("unsubscribeFromEntity deletes the subscription record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		const subId = await authed.mutation(
			api.notifications.api.subscribeToEntity,
			{
				entity: { entityType: "task", entityId: seeded.taskId },
			},
		);

		await authed.mutation(api.notifications.api.unsubscribeFromEntity, {
			entity: { entityType: "task", entityId: seeded.taskId },
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("notificationSubscriptions", subId),
		);
		expect(doc).toBeNull();
	});
});
