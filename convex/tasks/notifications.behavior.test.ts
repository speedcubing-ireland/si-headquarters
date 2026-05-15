import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
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

describe("task notification behavior", () => {
	test("changing assignee sends task_assigned to new and task_unassigned to old", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { assigneeId: seeded.newAssigneeId },
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		const assigned = notifications.filter(
			(n) => n.type === "task_assigned" && n.userId === seeded.newAssigneeId,
		);
		const unassigned = notifications.filter(
			(n) => n.type === "task_unassigned" && n.userId === seeded.oldAssigneeId,
		);
		expect(assigned.length).toBeGreaterThanOrEqual(1);
		expect(unassigned.length).toBeGreaterThanOrEqual(1);
	}, 15_000);

	test("changing status sends task_status_changed to subscribers (not actor)", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { status: "in-progress" },
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		const statusChanged = notifications.filter(
			(n) => n.type === "task_status_changed",
		);
		const actorNotified = statusChanged.filter(
			(n) => n.userId === seeded.actorId,
		);
		expect(statusChanged.length).toBeGreaterThanOrEqual(1);
		expect(actorNotified).toHaveLength(0);
	}, 15_000);

	test("changing priority sends task_priority_changed", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { priority: "high" },
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		expect(
			notifications.some((n) => n.type === "task_priority_changed"),
		).toBeTruthy();
	}, 15_000);

	test("changing due date sends due_date_changed", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { dueDate: "2026-07-15T12:00:00.000Z" },
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		expect(
			notifications.some((n) => n.type === "due_date_changed"),
		).toBeTruthy();
	}, 15_000);

	test("subscribeToEntity creates notificationSubscription record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithSubscribers(t);
		const authed = t.withIdentity({ subject: seeded.actorId });

		const subId = await authed.mutation(api.notifications.subscribeToEntity, {
			entity: { entityType: "task", entityId: seeded.taskId },
		});

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

		const subId = await authed.mutation(api.notifications.subscribeToEntity, {
			entity: { entityType: "task", entityId: seeded.taskId },
		});

		await authed.mutation(api.notifications.unsubscribeFromEntity, {
			entity: { entityType: "task", entityId: seeded.taskId },
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("notificationSubscriptions", subId),
		);
		expect(doc).toBeNull();
	});
});
