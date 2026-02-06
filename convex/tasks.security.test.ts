import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

type Fixture = {
	allowedParentTaskId: Id<"tasks">;
	allowedChildTaskId: Id<"tasks">;
	deniedTaskId: Id<"tasks">;
	assignedStandaloneTaskId: Id<"tasks">;
	ownedStandaloneTaskId: Id<"tasks">;
	deniedStandaloneTaskId: Id<"tasks">;
	orphanTaskId: Id<"tasks">;
	crossCompetitionChildTaskId: Id<"tasks">;
	noCompetitionChildTaskId: Id<"tasks">;
};

async function seedTaskAccessFixture(
	t: ReturnType<typeof convexTest>,
): Promise<{ viewerUserId: Id<"users">; fixture: Fixture }> {
	return t.run(async (ctx) => {
		const now = Date.now();
		const viewerUserId = await ctx.db.insert("users", {});
		const otherUserId = await ctx.db.insert("users", {});
		const allowedCompetitionId = await ctx.db.insert("competitions", {
			name: "Allowed Competition",
			description: "",
			compStart: "2026-01-01",
			compEnd: "2026-01-02",
			organiserIds: [viewerUserId],
			updatedAt: now,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId: allowedCompetitionId,
			userId: viewerUserId,
		});
		const deniedCompetitionId = await ctx.db.insert("competitions", {
			name: "Denied Competition",
			description: "",
			compStart: "2026-02-01",
			compEnd: "2026-02-02",
			organiserIds: [otherUserId],
			updatedAt: now,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId: deniedCompetitionId,
			userId: otherUserId,
		});

		const allowedParentTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-ALLOWED-PARENT",
			title: "Allowed Parent",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: allowedCompetitionId,
			labelIds: [],
			updatedAt: now,
		});
		const allowedChildTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-ALLOWED-CHILD",
			title: "Allowed Child",
			description: "",
			status: "to-do",
			priority: "low",
			archived: false,
			parentTaskId: allowedParentTaskId,
			parentCompetitionId: allowedCompetitionId,
			labelIds: [],
			updatedAt: now,
		});
		const deniedTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-DENIED",
			title: "Denied Task",
			description: "",
			status: "to-do",
			priority: "high",
			archived: false,
			parentCompetitionId: deniedCompetitionId,
			labelIds: [],
			updatedAt: now,
		});
		const assignedStandaloneTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-STANDALONE-ASSIGNED",
			title: "Assigned Standalone Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			assigneeId: viewerUserId,
			labelIds: [],
			updatedAt: now,
		});
		const ownedStandaloneTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-STANDALONE-OWNED",
			title: "Owned Standalone Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			ownerType: "user",
			ownerId: viewerUserId,
			assigneeId: otherUserId,
			labelIds: [],
			updatedAt: now,
		});
		const deniedStandaloneTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-STANDALONE-DENIED",
			title: "Denied Standalone Task",
			description: "",
			status: "to-do",
			priority: "low",
			archived: false,
			ownerType: "user",
			ownerId: otherUserId,
			assigneeId: otherUserId,
			labelIds: [],
			updatedAt: now,
		});
		const orphanTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-ORPHAN",
			title: "Orphan Task",
			description: "",
			status: "to-do",
			priority: "low",
			archived: false,
			labelIds: [],
			updatedAt: now,
		});
		const crossCompetitionChildTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-CROSS-CHILD",
			title: "Cross Competition Child",
			description: "",
			status: "to-do",
			priority: "low",
			archived: false,
			parentTaskId: allowedParentTaskId,
			parentCompetitionId: deniedCompetitionId,
			labelIds: [],
			updatedAt: now,
		});
		const noCompetitionChildTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-NO-COMP-CHILD",
			title: "No Competition Child",
			description: "",
			status: "to-do",
			priority: "low",
			archived: false,
			parentTaskId: allowedParentTaskId,
			labelIds: [],
			updatedAt: now,
		});

		return {
			viewerUserId,
			fixture: {
				allowedParentTaskId,
				allowedChildTaskId,
				deniedTaskId,
				assignedStandaloneTaskId,
				ownedStandaloneTaskId,
				deniedStandaloneTaskId,
				orphanTaskId,
				crossCompetitionChildTaskId,
				noCompetitionChildTaskId,
			} satisfies Fixture,
		};
	});
}

describe("tasks access control (non-volunteer)", () => {
	test("listForUI returns accessible competition and standalone tasks", async () => {
		const t = convexTest(schema, modules);
		const { viewerUserId, fixture } = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: viewerUserId });

		const tasks = await authed.query(api.tasks.listForUI, { archived: false });
		const taskIds = new Set(tasks.map((task) => task.id));

		expect(taskIds.has(fixture.allowedParentTaskId)).toBe(true);
		expect(taskIds.has(fixture.allowedChildTaskId)).toBe(true);
		expect(taskIds.has(fixture.deniedTaskId)).toBe(false);
		expect(taskIds.has(fixture.assignedStandaloneTaskId)).toBe(true);
		expect(taskIds.has(fixture.deniedStandaloneTaskId)).toBe(false);
		expect(taskIds.has(fixture.orphanTaskId)).toBe(false);
		expect(taskIds.has(fixture.crossCompetitionChildTaskId)).toBe(false);
		expect(taskIds.has(fixture.noCompetitionChildTaskId)).toBe(false);

		const parent = tasks.find(
			(task) => task.id === fixture.allowedParentTaskId,
		);
		const subTaskIds = parent?.subTasks.map((subTask) => subTask.id) ?? [];
		expect(subTaskIds).toEqual([fixture.allowedChildTaskId]);
	});

	test("list returns accessible competition and standalone tasks", async () => {
		const t = convexTest(schema, modules);
		const { viewerUserId, fixture } = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: viewerUserId });

		const tasks = await authed.query(api.tasks.list, { archived: false });
		const taskIds = new Set(tasks.map((task) => task._id));

		expect(taskIds.has(fixture.allowedParentTaskId)).toBe(true);
		expect(taskIds.has(fixture.allowedChildTaskId)).toBe(true);
		expect(taskIds.has(fixture.deniedTaskId)).toBe(false);
		expect(taskIds.has(fixture.assignedStandaloneTaskId)).toBe(true);
		expect(taskIds.has(fixture.deniedStandaloneTaskId)).toBe(false);
		expect(taskIds.has(fixture.orphanTaskId)).toBe(false);
		expect(taskIds.has(fixture.crossCompetitionChildTaskId)).toBe(false);
		expect(taskIds.has(fixture.noCompetitionChildTaskId)).toBe(false);
	});

	test("getForUI grants access to standalone tasks by assignment or ownership", async () => {
		const t = convexTest(schema, modules);
		const { viewerUserId, fixture } = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: viewerUserId });

		const allowedTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.allowedParentTaskId,
		});
		const deniedTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.deniedTaskId,
		});
		const assignedStandaloneTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.assignedStandaloneTaskId,
		});
		const ownedStandaloneTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.ownedStandaloneTaskId,
		});
		const deniedStandaloneTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.deniedStandaloneTaskId,
		});

		expect(allowedTask?.id).toBe(fixture.allowedParentTaskId);
		expect(deniedTask).toBeNull();
		expect(assignedStandaloneTask?.id).toBe(fixture.assignedStandaloneTaskId);
		expect(ownedStandaloneTask?.id).toBe(fixture.ownedStandaloneTaskId);
		expect(deniedStandaloneTask).toBeNull();
	});

	test("update allows accessible standalone tasks and rejects others", async () => {
		const t = convexTest(schema, modules);
		const { viewerUserId, fixture } = await seedTaskAccessFixture(t);
		const authed = t.withIdentity({ subject: viewerUserId });

		await expect(
			authed.mutation(api.tasks.update, {
				taskId: fixture.deniedTaskId,
				updates: { title: "Should fail" },
			}),
		).rejects.toBeTruthy();
		await expect(
			authed.mutation(api.tasks.update, {
				taskId: fixture.deniedStandaloneTaskId,
				updates: { title: "Should also fail" },
			}),
		).rejects.toBeTruthy();

		await authed.mutation(api.tasks.update, {
			taskId: fixture.allowedParentTaskId,
			updates: { title: "Allowed update" },
		});
		await authed.mutation(api.tasks.update, {
			taskId: fixture.ownedStandaloneTaskId,
			updates: { title: "Owned standalone update" },
		});
		const updatedTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.allowedParentTaskId,
		});
		const updatedOwnedStandaloneTask = await authed.query(api.tasks.getForUI, {
			taskId: fixture.ownedStandaloneTaskId,
		});
		expect(updatedTask?.title).toBe("Allowed update");
		expect(updatedOwnedStandaloneTask?.title).toBe("Owned standalone update");
	});
});
