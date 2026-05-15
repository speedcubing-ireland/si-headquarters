import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedForCreate(t: ReturnType<typeof convexTest>): Promise<{
	userId: Id<"users">;
	assigneeId: Id<"users">;
	competitionId: Id<"competitions">;
	phaseId: Id<"phases">;
	labelId: Id<"labels">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const assigneeId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [userId, assigneeId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-06-01",
			compEnd: "2026-06-02",
			organiserIds: [userId, assigneeId],
			updatedAt: Date.now(),
		});
		for (const uid of [userId, assigneeId]) {
			await ctx.db.insert("competitionAccess", { competitionId, userId: uid });
		}
		const phaseId = await ctx.db.insert("phases", {
			key: "phase-1",
			name: "Phase 1",
			description: "First phase",
			order: 1,
			archived: false,
		});
		const labelId = await ctx.db.insert("labels", {
			name: "Bug",
			color: "#ff0000",
			archived: false,
		});
		return { userId, assigneeId, competitionId, phaseId, labelId };
	});
}

describe("task creation behavior", () => {
	test("create task stores record with auto-incremented identifier", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const taskId = await authed.mutation(api.tasks.mutations.create, {
			title: "New Task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: seeded.competitionId,
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));
		expect(task?.title).toBe("New Task");
		expect(task?.status).toBe("to-do");
		expect(task?.priority).toBe("medium");
		expect(task?.identifier).toMatch(/^HQ-\d+$/);
		expect(task?.archived).toBe(false);
		expect(task?.updatedAt).toBeTypeOf("number");
	});

	test("create task with assignee sends task_assigned notification", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.create, {
			title: "Assigned Task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: seeded.competitionId,
			assigneeId: seeded.assigneeId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		const assigned = notifications.filter(
			(n) => n.type === "task_assigned" && n.userId === seeded.assigneeId,
		);
		expect(assigned.length).toBeGreaterThanOrEqual(1);
	}, 15_000);

	test("create task with assignee stores assigneeId on the task", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const taskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Assigned Task Direct",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: seeded.competitionId,
			assigneeId: seeded.assigneeId,
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));
		expect(task?.assigneeId).toBe(seeded.assigneeId);
	});

	test("create subtask sets parentTaskId", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const parentTaskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Parent",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: seeded.competitionId,
		});

		const childTaskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Child",
			status: "to-do",
			priority: "low",
			parentCompetitionId: seeded.competitionId,
			parentTaskId,
		});

		const child = await t.run((ctx) => ctx.db.get("tasks", childTaskId));
		expect(child?.parentTaskId).toBe(parentTaskId);
	});

	test("create task with phase and labels stores associations", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		const taskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Tagged Task",
			status: "backlog",
			priority: "high",
			parentCompetitionId: seeded.competitionId,
			phaseId: seeded.phaseId,
			labelIds: [seeded.labelId],
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));
		expect(task?.phaseId).toBe(seeded.phaseId);
		expect(task?.labelIds).toEqual([seeded.labelId]);
	});

	test("create task without assignee sends no task_assigned notification", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedForCreate(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.create, {
			title: "Unassigned",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: seeded.competitionId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		const assigned = notifications.filter((n) => n.type === "task_assigned");
		expect(assigned).toHaveLength(0);
	}, 15_000);
});
