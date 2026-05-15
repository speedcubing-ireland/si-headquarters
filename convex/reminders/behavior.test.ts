import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

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
			denied.mutation(
				api.reminders.api.create,
				reminderArgs(seeded.allowedTaskId),
			),
		).rejects.toBeTruthy();
	});

	test("create allows users with task access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		const reminderId = await allowed.mutation(
			api.reminders.api.create,
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
			allowed.mutation(
				api.reminders.api.create,
				reminderArgs(seeded.orphanTaskId),
			),
		).rejects.toBeTruthy();
	});

	test("create rejects invalid remindAt timestamps", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		await expect(
			allowed.mutation(api.reminders.api.create, {
				...reminderArgs(seeded.allowedTaskId),
				remindAt: "not-a-date",
			}),
		).rejects.toBeTruthy();
	});

	test("create rejects past remindAt timestamps", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });

		await expect(
			allowed.mutation(api.reminders.api.create, {
				...reminderArgs(seeded.allowedTaskId),
				remindAt: new Date(Date.now() - 60_000).toISOString(),
			}),
		).rejects.toBeTruthy();
	});

	test("create rejects endDate values before remindAt", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });
		const remindAt = new Date(Date.now() + 120_000).toISOString();

		await expect(
			allowed.mutation(api.reminders.api.create, {
				...reminderArgs(seeded.allowedTaskId),
				remindAt,
				endDate: new Date(Date.now() + 60_000).toISOString(),
			}),
		).rejects.toBeTruthy();
	});

	test("snooze rejects invalid snoozeUntil timestamps", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });
		const reminderId = await allowed.mutation(
			api.reminders.api.create,
			reminderArgs(seeded.allowedTaskId),
		);

		await expect(
			allowed.mutation(api.reminders.api.snooze, {
				reminderId,
				snoozeUntil: "bad-date",
			}),
		).rejects.toBeTruthy();
	});

	test("reschedule rejects past remindAt timestamps", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });
		const reminderId = await allowed.mutation(
			api.reminders.api.create,
			reminderArgs(seeded.allowedTaskId),
		);

		await expect(
			allowed.mutation(api.reminders.api.reschedule, {
				reminderId,
				remindAt: new Date(Date.now() - 60_000).toISOString(),
			}),
		).rejects.toBeTruthy();
	});

	test("reschedule updates remindAt to new future timestamp", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });
		const reminderId = await allowed.mutation(
			api.reminders.api.create,
			reminderArgs(seeded.allowedTaskId),
		);

		const newRemindAt = new Date(Date.now() + 7_200_000).toISOString();
		await allowed.mutation(api.reminders.api.reschedule, {
			reminderId,
			remindAt: newRemindAt,
		});

		const doc = await t.run((ctx) => ctx.db.get("reminders", reminderId));
		expect(doc?.remindAt).toBe(Date.parse(newRemindAt));
	});

	test("cancel deletes the reminder record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedReminderFixture(t);
		const allowed = t.withIdentity({ subject: seeded.allowedUserId });
		const reminderId = await allowed.mutation(
			api.reminders.api.create,
			reminderArgs(seeded.allowedTaskId),
		);

		await allowed.mutation(api.reminders.api.cancel, { reminderId });

		const doc = await t.run((ctx) => ctx.db.get("reminders", reminderId));
		expect(doc).toBeNull();
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

			await t.mutation(internal.reminders.api._triggerReminder, {
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
