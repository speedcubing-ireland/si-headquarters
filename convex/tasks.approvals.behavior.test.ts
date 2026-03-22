import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { TEAM_NAMES } from "./lib/constants";

async function seedTaskWithApprover(t: ReturnType<typeof convexTest>): Promise<{
	ownerId: Id<"users">;
	approverId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
}> {
	return t.run(async (ctx) => {
		const ownerId = await ctx.db.insert("users", {});
		const approverId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [ownerId, approverId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-06-01",
			compEnd: "2026-06-02",
			organiserIds: [ownerId, approverId],
			updatedAt: Date.now(),
		});
		for (const uid of [ownerId, approverId]) {
			await ctx.db.insert("competitionAccess", { competitionId, userId: uid });
		}
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-350",
			title: "Approval Task",
			description: "",
			status: "awaiting-review",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			requiredApprovalIds: [],
			approvedByIds: [],
			updatedAt: Date.now(),
		});
		return { ownerId, approverId, competitionId, taskId };
	});
}

describe("task approval behavior", () => {
	test("addRequiredApprover adds user to requiredApprovalIds", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);
		const authed = t.withIdentity({ subject: seeded.ownerId });

		await authed.mutation(api.tasks.addRequiredApprover, {
			taskId: seeded.taskId,
			approverType: "user",
			approverId: seeded.approverId,
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.requiredApprovalIds?.length).toBeGreaterThanOrEqual(1);
		expect(
			task?.requiredApprovalIds?.some((id: string) =>
				id.includes(`${seeded.approverId}`),
			),
		).toBeTruthy();
	});

	test("removeRequiredApprover removes approver from list", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);
		const authed = t.withIdentity({ subject: seeded.ownerId });

		await authed.mutation(api.tasks.addRequiredApprover, {
			taskId: seeded.taskId,
			approverType: "user",
			approverId: seeded.approverId,
		});

		const taskBefore = await t.run((ctx) =>
			ctx.db.get("tasks", seeded.taskId),
		);
		const approverKey = taskBefore?.requiredApprovalIds?.[0];
		expect(approverKey).toBeTruthy();

		await authed.mutation(api.tasks.removeRequiredApprover, {
			taskId: seeded.taskId,
			approverKey: approverKey!,
		});

		const taskAfter = await t.run((ctx) =>
			ctx.db.get("tasks", seeded.taskId),
		);
		expect(taskAfter?.requiredApprovalIds).toHaveLength(0);
	});

	test("approveTask adds user to approvedByIds", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);
		const authed = t.withIdentity({ subject: seeded.approverId });

		await authed.mutation(api.tasks.approveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.approvedByIds).toContain(seeded.approverId);
	}, 15_000);

	test("approveTask sends task_approved notification to subscribers", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);

		await t.run(async (ctx) => {
			await ctx.db.insert("notificationSubscriptions", {
				userId: seeded.ownerId,
				entityType: "task",
				entityId: `${seeded.taskId}`,
				updatedAt: Date.now(),
			});
		});

		const approver = t.withIdentity({ subject: seeded.approverId });
		await approver.mutation(api.tasks.approveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		expect(
			notifications.some((n) => n.type === "task_approved"),
		).toBeTruthy();
	}, 15_000);

	test("unapproveTask removes user from approvedByIds", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);
		const approver = t.withIdentity({ subject: seeded.approverId });

		await approver.mutation(api.tasks.approveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await approver.mutation(api.tasks.unapproveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.approvedByIds).not.toContain(seeded.approverId);
	}, 15_000);

	test("unapproveTask sends task_unapproved notification", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithApprover(t);

		await t.run(async (ctx) => {
			await ctx.db.insert("notificationSubscriptions", {
				userId: seeded.ownerId,
				entityType: "task",
				entityId: `${seeded.taskId}`,
				updatedAt: Date.now(),
			});
		});

		const approver = t.withIdentity({ subject: seeded.approverId });
		await approver.mutation(api.tasks.approveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await approver.mutation(api.tasks.unapproveTask, {
			taskId: seeded.taskId,
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db.query("notifications").collect(),
		);
		expect(
			notifications.some((n) => n.type === "task_unapproved"),
		).toBeTruthy();
	}, 15_000);
});
