import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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
		const reminder = await t.run((ctx) => ctx.db.get("reminders", reminderId));
		expect(reminder?.scheduledFunctionId).toBeDefined();
	});

	test("create rejects non-volunteers for tasks without competitions", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		await expect(
			allowed.mutation(api.reminders.create, reminderArgs(seeded.orphanTaskId)),
		).rejects.toBeTruthy();
	});

	test("_triggerReminder marks due reminders triggered and creates reminder notifications", async () => {
		vi.useFakeTimers();
		try {
			const t = convexTest(schema, modules);
			const seeded = await seedReminderFixture(t);
			const now = Date.now();
			vi.setSystemTime(now);

			const reminderId = await t.run((ctx) =>
				ctx.db.insert("reminders", {
					userId: seeded.allowedUserId,
					entityType: "task",
					entityId: seeded.allowedTaskId,
					type: "one_time",
					remindAt: now - 60_000,
					recurringConfig: {},
					status: "pending",
					priority: "normal",
					metadata: {},
					updatedAt: now,
				}),
			);

			await t.mutation(internal.reminders._triggerReminder, {
				reminderId,
			});
			await t.finishAllScheduledFunctions(() => {
				vi.runAllTimers();
			});

			const [reminder, notifications] = await t.run((ctx) =>
				Promise.all([
					ctx.db.get("reminders", reminderId),
					ctx.db
						.query("notifications")
						.withIndex("by_user", (q) => q.eq("userId", seeded.allowedUserId))
						.collect(),
				]),
			);

			expect(reminder?.status).toBe("triggered");
			expect(
				notifications.some(
					(notification) =>
						notification.type === "reminder_triggered" &&
						notification.entityType === "reminder" &&
						notification.entityId === reminderId,
				),
			).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});
