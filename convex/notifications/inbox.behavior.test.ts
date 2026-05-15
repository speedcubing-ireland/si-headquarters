import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function seedNotification(t: ReturnType<typeof convexTest>): Promise<{
	userId: Id<"users">;
	notificationId: Id<"notifications">;
}> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const notificationId = await ctx.db.insert("notifications", {
			userId,
			type: "task_assigned",
			priority: "normal",
			status: "unread",
			title: "Test Notification",
			message: "You were assigned a task",
			entityType: "task",
			entityId: "task-test",
			metadata: {},
			isBatchable: false,
		});
		return { userId, notificationId };
	});
}

describe("notifications inbox behavior", () => {
	test("markRead sets status to read and populates readAt", async () => {
		const t = convexTest(schema, modules);
		const { userId, notificationId } = await seedNotification(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.inbox.markRead, { notificationId });

		const doc = await t.run((ctx) =>
			ctx.db.get("notifications", notificationId),
		);
		expect(doc?.status).toBe("read");
		expect(doc?.readAt).toBeTypeOf("number");
	});

	test("markAllRead updates all visible unread notifications", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await t.run(async (ctx) => {
			await ctx.db.insert("notifications", {
				userId,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "N1",
				message: "N1",
				entityType: "task",
				entityId: "task-1",
				metadata: {},
				isBatchable: false,
			});
			await ctx.db.insert("notifications", {
				userId,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "N2",
				message: "N2",
				entityType: "task",
				entityId: "task-2",
				metadata: {},
				isBatchable: false,
			});
		});

		await authed.mutation(api.notifications.inbox.markAllRead, {});

		const unread = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", userId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(unread).toHaveLength(0);
	});

	test("markArchived sets status to archived and populates archivedAt", async () => {
		const t = convexTest(schema, modules);
		const { userId, notificationId } = await seedNotification(t);
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.inbox.markArchived, {
			notificationId,
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("notifications", notificationId),
		);
		expect(doc?.status).toBe("archived");
		expect(doc?.archivedAt).toBeTypeOf("number");
	});

	test("snooze sets snoozedUntil and resets status to unread", async () => {
		const t = convexTest(schema, modules);
		const { userId, notificationId } = await seedNotification(t);
		const authed = t.withIdentity({ subject: userId });

		const futureDate = new Date(Date.now() + 3_600_000).toISOString();
		await authed.mutation(api.notifications.inbox.snooze, {
			notificationId,
			snoozedUntil: futureDate,
		});

		const doc = await t.run((ctx) =>
			ctx.db.get("notifications", notificationId),
		);
		expect(doc?.status).toBe("unread");
		expect(doc?.snoozedUntil).toBeTypeOf("number");
		expect(doc?.snoozedUntil).toBeGreaterThan(Date.now());
	});

	test("unsnooze clears snoozedUntil", async () => {
		const t = convexTest(schema, modules);
		const { userId, notificationId } = await seedNotification(t);
		const authed = t.withIdentity({ subject: userId });

		const futureDate = new Date(Date.now() + 3_600_000).toISOString();
		await authed.mutation(api.notifications.inbox.snooze, {
			notificationId,
			snoozedUntil: futureDate,
		});
		await authed.mutation(api.notifications.inbox.unsnooze, { notificationId });

		const doc = await t.run((ctx) =>
			ctx.db.get("notifications", notificationId),
		);
		expect(doc?.snoozedUntil).toBeUndefined();
	});

	test("upsertUserSettings creates and retrieves notification settings", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await authed.mutation(api.notifications.settings.upsertUserSettings, {
			timezone: "Europe/Dublin",
			defaultDigestMode: "daily",
		});

		const settings = await authed.query(
			api.notifications.settings.getUserSettings,
			{},
		);
		expect(settings.timezone).toBe("Europe/Dublin");
		expect(settings.defaultDigestMode).toBe("daily");
	});
});
