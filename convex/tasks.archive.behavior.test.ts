import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { TEAM_NAMES } from "./lib/constants";

async function seedTaskWithAccess(
	t: ReturnType<typeof convexTest>,
): Promise<{
	userId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
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
			compStart: "2026-01-01",
			compEnd: "2026-01-02",
			organiserIds: [userId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId,
		});
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-100",
			title: "Test Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		return { userId, competitionId, taskId };
	});
}

describe("tasks archive behavior", () => {
	test("archive sets archived: true and archivedAt on a single task", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId } = await seedTaskWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.tasks.archive, { taskIds: [taskId] });
		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));

		expect(task?.archived).toBe(true);
		expect(task?.archivedAt).toBeTruthy();
	});

	test("unarchive sets archived: false and clears archivedAt", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId } = await seedTaskWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.tasks.archive, { taskIds: [taskId] });
		await authed.mutation(api.tasks.unarchive, { taskIds: [taskId] });
		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));

		expect(task?.archived).toBe(false);
		expect(task?.archivedAt).toBeUndefined();
	});

	test("bulk archive sets archived: true on all provided tasks", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId, taskId } = await seedTaskWithAccess(t);
		const task2Id = await t.run((ctx) =>
			ctx.db.insert("tasks", {
				identifier: "HQ-101",
				title: "Task 2",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			}),
		);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.tasks.archive, { taskIds: [taskId, task2Id] });
		const [t1, t2] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("tasks", taskId),
				ctx.db.get("tasks", task2Id),
			]),
		);

		expect(t1?.archived).toBe(true);
		expect(t2?.archived).toBe(true);
	});

	test("archive preserves comments, relations, and subscriptions", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId } = await seedTaskWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		const commentId = await t.run(async (ctx) => {
			const cId = await ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${taskId}`,
				authorId: userId,
				content: "Important comment",
				reactions: [],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId,
				entityType: "task",
				entityId: `${taskId}`,
				updatedAt: Date.now(),
			});
			return cId;
		});

		await authed.mutation(api.tasks.archive, { taskIds: [taskId] });

		const [comment, subs] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("comments", commentId),
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "task").eq("entityId", `${taskId}`),
					)
					.collect(),
			]),
		);
		expect(comment).toBeTruthy();
		expect(subs).toHaveLength(1);
	});

	test("bulk delete removes all tasks and cascading data", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId } = await seedTaskWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		await t.run(async (ctx) => {
			await ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${taskId}`,
				authorId: userId,
				content: "Will be deleted",
				reactions: [],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId,
				entityType: "task",
				entityId: `${taskId}`,
				updatedAt: Date.now(),
			});
		});

		await authed.mutation(api.tasks.remove, { taskIds: [taskId] });

		const [task, comments, subs] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("tasks", taskId),
				ctx.db
					.query("comments")
					.withIndex("by_parent", (q) =>
						q.eq("parentType", "task").eq("parentId", `${taskId}`),
					)
					.collect(),
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "task").eq("entityId", `${taskId}`),
					)
					.collect(),
			]),
		);
		expect(task).toBeNull();
		expect(comments).toHaveLength(0);
		expect(subs).toHaveLength(0);
	});

	test("bulk delete collects subtasks recursively", async () => {
		const t = convexTest(schema, modules);
		const { userId, taskId, competitionId } = await seedTaskWithAccess(t);
		const authed = t.withIdentity({ subject: userId });

		const childId = await t.run((ctx) =>
			ctx.db.insert("tasks", {
				identifier: "HQ-102",
				title: "Child Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				parentTaskId: taskId,
				labelIds: [],
				updatedAt: Date.now(),
			}),
		);

		await authed.mutation(api.tasks.remove, { taskIds: [taskId] });

		const [parent, child] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("tasks", taskId),
				ctx.db.get("tasks", childId),
			]),
		);
		expect(parent).toBeNull();
		expect(child).toBeNull();
	});
});
