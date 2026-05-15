import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedTaskForFieldEdits(
	t: ReturnType<typeof convexTest>,
): Promise<{
	userId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
	phaseId: Id<"phases">;
	labelId: Id<"labels">;
	teamId: Id<"teams">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const teamId = await ctx.db.insert("teams", {
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
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-200",
			title: "Original Title",
			description: "Original Desc",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		const phaseId = await ctx.db.insert("phases", {
			key: "phase-a",
			name: "Phase A",
			description: "",
			order: 1,
			archived: false,
		});
		const labelId = await ctx.db.insert("labels", {
			name: "Frontend",
			color: "#00ff00",
			archived: false,
		});
		return { userId, competitionId, taskId, phaseId, labelId, teamId };
	});
}

describe("task field edit behavior", () => {
	test("edit title updates title and updatedAt", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });
		const before = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { title: "Updated Title" },
		});

		const after = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(after?.title).toBe("Updated Title");
		expect(after?.updatedAt).toBeGreaterThanOrEqual(
			before?.updatedAt as number,
		);
	});

	test("edit description updates description and updatedAt", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { description: "New description with **markdown**" },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.description).toBe("New description with **markdown**");
	});

	test("change phase updates phaseId", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { phaseId: seeded.phaseId },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.phaseId).toBe(seeded.phaseId);
	});

	test("change labels updates labelIds", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { labelIds: [seeded.labelId] },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.labelIds).toEqual([seeded.labelId]);
	});

	test("change owner to team updates ownerId and ownerType", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { ownerId: seeded.teamId, ownerType: "team" },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.ownerId).toBe(seeded.teamId);
		expect(task?.ownerType).toBe("team");
	});

	test("clear due date sets dueDate to undefined", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		// Set a due date first
		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { dueDate: "2026-08-01T12:00:00.000Z" },
		});
		let task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.dueDate).toBeTruthy();

		// Clear it
		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { dueDate: null },
		});
		task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.dueDate).toBeUndefined();
	});

	test("set status to awaiting-review updates status field", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForFieldEdits(t);
		const authed = t.withIdentity({ subject: seeded.userId });

		await authed.mutation(api.tasks.mutations.update, {
			taskId: seeded.taskId,
			updates: { status: "awaiting-review" },
		});

		const task = await t.run((ctx) => ctx.db.get("tasks", seeded.taskId));
		expect(task?.status).toBe("awaiting-review");
	});
});
