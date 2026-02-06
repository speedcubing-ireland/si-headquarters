import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedReminderFixture(t: ReturnType<typeof convexTest>): Promise<{
	allowedUserId: Id<"users">;
	deniedUserId: Id<"users">;
	allowedTaskId: Id<"tasks">;
	orphanTaskId: Id<"tasks">;
}> {
	return t.run(async (ctx) => {
		const now = Date.now();
		const allowedUserId = await ctx.db.insert("users", {});
		const deniedUserId = await ctx.db.insert("users", {});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-10-01",
			compEnd: "2026-10-02",
			organiserIds: [allowedUserId],
			updatedAt: now,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: allowedUserId,
		});
		const allowedTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-REM-1",
			title: "Allowed task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: now,
		});
		const orphanTaskId = await ctx.db.insert("tasks", {
			identifier: "HQ-REM-2",
			title: "No competition task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			labelIds: [],
			updatedAt: now,
		});
		return { allowedUserId, deniedUserId, allowedTaskId, orphanTaskId };
	});
}

function reminderArgs(taskId: Id<"tasks">) {
	return {
		entityId: taskId,
		type: "one_time" as const,
		remindAt: new Date(Date.now() + 60_000).toISOString(),
		recurringConfig: {},
	};
}

describe("reminders behavior characterization", () => {
	test("create rejects users without task access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const denied = t.withIdentity({ subject: seeded.deniedUserId });

		await expect(
			denied.mutation(api.reminders.create, reminderArgs(seeded.allowedTaskId)),
		).rejects.toBeTruthy();
	});

	test("create allows users with task access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		const reminderId = await allowed.mutation(
			api.reminders.create,
			reminderArgs(seeded.allowedTaskId),
		);
		expect(reminderId).toBeDefined();
	});

	test("create rejects non-volunteers for tasks without competitions", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		await expect(
			allowed.mutation(api.reminders.create, reminderArgs(seeded.orphanTaskId)),
		).rejects.toBeTruthy();
	});
});
