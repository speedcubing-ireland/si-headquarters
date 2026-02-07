import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

type NotificationInsert = {
	userId: Id<"users">;
	status: "unread" | "read" | "archived";
	scheduledFor?: number;
	snoozedUntil?: number;
};

async function insertNotification(
	t: ReturnType<typeof convexTest>,
	args: NotificationInsert,
): Promise<Id<"notifications">> {
	return t.run(async (ctx) =>
		ctx.db.insert("notifications", {
			userId: args.userId,
			type: "task_assigned",
			priority: "normal",
			status: args.status,
			title: "Title",
			message: "Message",
			entityType: "task",
			entityId: "task-1",
			metadata: {},
			scheduledFor: args.scheduledFor,
			snoozedUntil: args.snoozedUntil,
			isBatchable: false,
		}),
	);
}

describe("notifications behavior characterization", () => {
	test("listForUser excludes notifications scheduled in the future", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		const now = Date.now();
		const past = now - 5_000;
		const future = now + 60_000;

		const visibleA = await insertNotification(t, {
			userId: me,
			status: "unread",
			scheduledFor: past,
		});
		const visibleB = await insertNotification(t, {
			userId: me,
			status: "read",
			scheduledFor: past,
		});
		const hidden = await insertNotification(t, {
			userId: me,
			status: "archived",
			scheduledFor: future,
		});
		const visibleC = await insertNotification(t, {
			userId: me,
			status: "unread",
		});

		const rows = await authed.query(api.notifications.listForUser, {
			limit: 50,
			nowMs: future + 86_400_000,
		});
		const ids = rows.map((row) => row.id);

		expect(ids).toContain(visibleA);
		expect(ids).toContain(visibleB);
		expect(ids).toContain(visibleC);
		expect(ids).not.toContain(hidden);
		expect(ids[0]).toBe(visibleC);
	});

	test("listForUser paginates until enough visible notifications are found", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });
		const now = Date.now();

		await t.run(async (ctx) => {
			for (let i = 0; i < 30; i++) {
				await ctx.db.insert("notifications", {
					userId: me,
					type: "task_assigned",
					priority: "normal",
					status: "unread",
					title: `Visible ${i}`,
					message: "Message",
					entityType: "task",
					entityId: `task-visible-${i}`,
					metadata: {},
					scheduledFor: now - 1_000,
					isBatchable: false,
				});
			}
			for (let i = 0; i < 320; i++) {
				await ctx.db.insert("notifications", {
					userId: me,
					type: "task_assigned",
					priority: "normal",
					status: "unread",
					title: `Hidden ${i}`,
					message: "Message",
					entityType: "task",
					entityId: `task-hidden-${i}`,
					metadata: {},
					scheduledFor: now + 60_000,
					isBatchable: false,
				});
			}
		});

		const rows = await authed.query(api.notifications.listForUser, {
			limit: 20,
		});
		expect(rows).toHaveLength(20);
		expect(
			rows.every(
				(row) =>
					typeof row.scheduledFor === "string" &&
					new Date(row.scheduledFor).getTime() <= now,
			),
		).toBe(true);
	});

	test("getUnreadCount ignores snoozed or future-scheduled unread notifications", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		const now = Date.now();

		await insertNotification(t, {
			userId: me,
			status: "unread",
		});
		await insertNotification(t, {
			userId: me,
			status: "unread",
			snoozedUntil: now + 30_000,
		});
		await insertNotification(t, {
			userId: me,
			status: "unread",
			scheduledFor: now + 30_000,
		});
		await insertNotification(t, {
			userId: me,
			status: "read",
		});

		const unreadCount = await authed.query(api.notifications.getUnreadCount, {
			nowMs: now + 86_400_000,
		});
		expect(unreadCount).toBe(1);
	});

	test("markAllRead only marks currently visible unread notifications", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		const now = Date.now();
		const eligible = await insertNotification(t, {
			userId: me,
			status: "unread",
		});
		const snoozed = await insertNotification(t, {
			userId: me,
			status: "unread",
			snoozedUntil: now + 30_000,
		});
		const scheduled = await insertNotification(t, {
			userId: me,
			status: "unread",
			scheduledFor: now + 30_000,
		});

		await authed.mutation(api.notifications.markAllRead, {});

		const [eligibleRow, snoozedRow, scheduledRow] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("notifications", eligible),
				ctx.db.get("notifications", snoozed),
				ctx.db.get("notifications", scheduled),
			]),
		);

		expect(eligibleRow?.status).toBe("read");
		expect(typeof eligibleRow?.readAt).toBe("number");
		expect(snoozedRow?.status).toBe("unread");
		expect(scheduledRow?.status).toBe("unread");
	});

	test("upsertPreference keeps in_app channel digest mode as immediate", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		await authed.mutation(api.notifications.upsertPreference, {
			type: "task_assigned",
			channel: "in_app",
			enabled: true,
			digestMode: "daily",
		});

		const preferences = await authed.query(
			api.notifications.listPreferences,
			{},
		);
		const row = preferences.find(
			(pref) => pref.type === "task_assigned" && pref.channel === "in_app",
		);

		expect(row).toBeDefined();
		expect(row?.digestMode).toBe("immediate");
	});

	test("subscribeToEntity enforces task access for non-volunteer users", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const allowedUser = await ctx.db.insert("users", {});
			const deniedUser = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-01-01",
				compEnd: "2026-01-02",
				organiserIds: [allowedUser],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: allowedUser,
			});
			const createdTaskId = await ctx.db.insert("tasks", {
				identifier: "HQ-1",
				title: "Task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { allowedUser, deniedUser, createdTaskId };
		});

		const allowed = t.withIdentity({ subject: seeded.allowedUser });
		const denied = t.withIdentity({ subject: seeded.deniedUser });

		await expect(
			denied.mutation(api.notifications.subscribeToEntity, {
				entity: { entityType: "task", entityId: seeded.createdTaskId },
			}),
		).rejects.toBeTruthy();

		const subscriptionId = await allowed.mutation(
			api.notifications.subscribeToEntity,
			{
				entity: { entityType: "task", entityId: seeded.createdTaskId },
			},
		);
		expect(subscriptionId).toBeDefined();
	});

	test("_checkDueDates emits overdue and approaching notifications for active assigned tasks", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const assigneeId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-05-01",
				compEnd: "2026-05-02",
				organiserIds: [assigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});

			const now = Date.now();
			await ctx.db.insert("tasks", {
				identifier: "HQ-301",
				title: "Overdue task",
				description: "",
				status: "in-progress",
				priority: "high",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: now,
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-302",
				title: "Approaching task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: now,
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-303",
				title: "No assignee",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				dueDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: now,
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-304",
				title: "Done task",
				description: "",
				status: "done",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: now,
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-305",
				title: "Far future task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: now,
			});

			return { assigneeId };
		});

		const count = await t.mutation(internal.notifications._checkDueDates, {});
		expect(count).toBe(2);

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.assigneeId).eq("status", "unread"),
				)
				.collect(),
		);

		expect(notifications).toHaveLength(2);
		expect(notifications.map((n) => n.type).sort()).toEqual([
			"due_date_approaching",
			"due_date_overdue",
		]);
	});

	test("_checkDueDates does not create duplicate notifications within the same day", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			const assigneeId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Comp",
				description: "",
				compStart: "2026-06-01",
				compEnd: "2026-06-02",
				organiserIds: [assigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});
			await ctx.db.insert("tasks", {
				identifier: "HQ-401",
				title: "Overdue once per day",
				description: "",
				status: "in-progress",
				priority: "high",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: Date.now(),
			});
		});

		await t.mutation(internal.notifications._checkDueDates, {});
		await t.mutation(internal.notifications._checkDueDates, {});

		const notificationCount = await t.run(
			async (ctx) => (await ctx.db.query("notifications").collect()).length,
		);
		expect(notificationCount).toBe(1);
	});

	test("_notifyTaskAssigned skips self-recipient notifications with self_action reason", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Self action comp",
				description: "",
				compStart: "2026-07-01",
				compEnd: "2026-07-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-501",
				title: "Self assignment",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: userId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { userId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskAssigned,
			{
				taskId: seeded.taskId,
				assigneeId: seeded.userId,
				actorId: seeded.userId,
				eventKey: "self-action",
			},
		);
		expect(result).toBeNull();

		const skippedDispatches = await t.run((ctx) =>
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", seeded.userId).eq("status", "skipped"),
				)
				.collect(),
		);
		expect(
			skippedDispatches.some(
				(dispatch) =>
					dispatch.channel === "in_app" && dispatch.reason === "self_action",
			),
		).toBe(true);
	});

	test("_notifyTaskAssigned skips recipients without access with no_access reason", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Restricted comp",
				description: "",
				compStart: "2026-08-01",
				compEnd: "2026-08-02",
				organiserIds: [actorId],
				updatedAt: Date.now(),
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-502",
				title: "Restricted assignment",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: recipientId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { actorId, recipientId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskAssigned,
			{
				taskId: seeded.taskId,
				assigneeId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "no-access",
			},
		);
		expect(result).toBeNull();

		const skippedDispatches = await t.run((ctx) =>
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", seeded.recipientId).eq("status", "skipped"),
				)
				.collect(),
		);
		expect(
			skippedDispatches.some(
				(dispatch) =>
					dispatch.channel === "in_app" && dispatch.reason === "no_access",
			),
		).toBe(true);
	});

	test("_notifyTaskAssigned skips when in_app preference is disabled", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Preference comp",
				description: "",
				compStart: "2026-09-01",
				compEnd: "2026-09-02",
				organiserIds: [actorId, recipientId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: recipientId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-503",
				title: "Preference-disabled assignment",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: recipientId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { actorId, recipientId, taskId };
		});

		const recipientAuthed = t.withIdentity({ subject: seeded.recipientId });
		await recipientAuthed.mutation(api.notifications.upsertPreference, {
			type: "task_assigned",
			channel: "in_app",
			enabled: false,
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskAssigned,
			{
				taskId: seeded.taskId,
				assigneeId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "preference-disabled",
			},
		);
		expect(result).toBeNull();

		const skippedDispatches = await t.run((ctx) =>
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", seeded.recipientId).eq("status", "skipped"),
				)
				.collect(),
		);
		expect(
			skippedDispatches.some(
				(dispatch) =>
					dispatch.channel === "in_app" &&
					dispatch.reason === "preference_disabled",
			),
		).toBe(true);
	});

	test("_notifyDueDateOverdue dedupes unread batch notifications with batch_deduped reason", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const assigneeId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Batch dedupe comp",
				description: "",
				compStart: "2026-10-01",
				compEnd: "2026-10-02",
				organiserIds: [assigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-504",
				title: "Batch dedupe task",
				description: "",
				status: "in-progress",
				priority: "high",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId,
				dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { assigneeId, taskId };
		});

		const first = await t.mutation(
			internal.notifications._notifyDueDateOverdue,
			{
				taskId: seeded.taskId,
				assigneeId: seeded.assigneeId,
				daysOverdue: 1,
				eventKey: "batch-first",
			},
		);
		const second = await t.mutation(
			internal.notifications._notifyDueDateOverdue,
			{
				taskId: seeded.taskId,
				assigneeId: seeded.assigneeId,
				daysOverdue: 1,
				eventKey: "batch-second",
			},
		);

		expect(first).toBeTruthy();
		expect(second).toBeNull();

		const skippedDispatches = await t.run((ctx) =>
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", seeded.assigneeId).eq("status", "skipped"),
				)
				.collect(),
		);
		expect(
			skippedDispatches.some(
				(dispatch) =>
					dispatch.channel === "in_app" && dispatch.reason === "batch_deduped",
			),
		).toBe(true);
	});

	test("_notifyCompetitionPhaseChanged delivers notification for recipients with competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Delivery comp",
				description: "",
				compStart: "2026-12-01",
				compEnd: "2026-12-02",
				organiserIds: [actorId, recipientId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: recipientId,
			});
			return { actorId, recipientId, competitionId };
		});

		const notificationId = await t.mutation(
			internal.notifications._notifyCompetitionPhaseChanged,
			{
				competitionId: seeded.competitionId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				oldPhaseName: "Planning",
				newPhaseName: "Execution",
				eventKey: "phase-delivery",
			},
		);
		expect(notificationId).toBeTruthy();
		if (!notificationId) {
			throw new Error("Expected competition phase notification id");
		}

		const row = await t.run((ctx) =>
			ctx.db.get("notifications", notificationId),
		);
		expect(row?.type).toBe("competition_phase_changed");
		expect(row?.userId).toBe(seeded.recipientId);
		expect(row?.entityType).toBe("competition");
		expect(row?.metadata?.oldValue).toBe("Planning");
		expect(row?.metadata?.newValue).toBe("Execution");
	});

	test("_notifyCompetitionPhaseChanged skips recipients without competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Restricted comp",
				description: "",
				compStart: "2026-12-10",
				compEnd: "2026-12-11",
				organiserIds: [actorId],
				updatedAt: Date.now(),
			});
			return { actorId, recipientId, competitionId };
		});

		const notificationId = await t.mutation(
			internal.notifications._notifyCompetitionPhaseChanged,
			{
				competitionId: seeded.competitionId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				oldPhaseName: "Planning",
				newPhaseName: "Execution",
				eventKey: "phase-no-access",
			},
		);
		expect(notificationId).toBeNull();

		const skippedDispatches = await t.run((ctx) =>
			ctx.db
				.query("notificationDispatches")
				.withIndex("by_user_status", (q) =>
					q.eq("userId", seeded.recipientId).eq("status", "skipped"),
				)
				.collect(),
		);
		expect(
			skippedDispatches.some(
				(dispatch) =>
					dispatch.channel === "in_app" && dispatch.reason === "no_access",
			),
		).toBe(true);
	});
});

async function seedTaskWithWatcher(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const actorId = await ctx.db.insert("users", {});
		const watcherId = await ctx.db.insert("users", {});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Watcher comp",
			description: "",
			compStart: "2026-03-01",
			compEnd: "2026-03-02",
			organiserIds: [actorId, watcherId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: actorId,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: watcherId,
		});
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-W01",
			title: "Watched task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("notificationSubscriptions", {
			userId: watcherId,
			subscriptionType: "entity",
			entityType: "task",
			entityId: `${taskId}`,
			updatedAt: Date.now(),
		});
		return { actorId, watcherId, competitionId, taskId };
	});
}

describe("watcher and subscriber notification paths", () => {
	test("_notifyTaskStatusChanged notifies entity subscribers (watchers) even with empty direct recipients", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithWatcher(t);

		const result = await t.mutation(
			internal.notifications._notifyTaskStatusChanged,
			{
				taskId: seeded.taskId,
				recipientIds: [],
				actorId: seeded.actorId,
				oldStatus: "to-do",
				newStatus: "in-progress",
				eventKey: "watcher-status-change",
			},
		);

		expect(result).toBeTruthy();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.watcherId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]?.type).toBe("task_status_changed");
	});

	test("_notifyTaskPriorityChanged notifies entity subscribers (watchers) even with empty direct recipients", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithWatcher(t);

		const result = await t.mutation(
			internal.notifications._notifyTaskPriorityChanged,
			{
				taskId: seeded.taskId,
				recipientIds: [],
				actorId: seeded.actorId,
				oldPriority: "medium",
				newPriority: "high",
				eventKey: "watcher-priority-change",
			},
		);

		expect(result).toBeTruthy();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.watcherId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]?.type).toBe("task_priority_changed");
	});

	test("_notifyTaskStatusChanged does not duplicate notifications for watchers who are also direct recipients", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithWatcher(t);

		await t.mutation(internal.notifications._notifyTaskStatusChanged, {
			taskId: seeded.taskId,
			recipientIds: [seeded.watcherId],
			actorId: seeded.actorId,
			oldStatus: "to-do",
			newStatus: "in-progress",
			eventKey: "dedup-watcher-direct",
		});

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.watcherId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
	});

	test("_notifyTaskStatusChanged suppresses self-action for watchers who are the actor", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Self-watcher comp",
				description: "",
				compStart: "2026-04-01",
				compEnd: "2026-04-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-W02",
				title: "Self-watched task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId,
				subscriptionType: "entity",
				entityType: "task",
				entityId: `${taskId}`,
				updatedAt: Date.now(),
			});
			return { userId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskStatusChanged,
			{
				taskId: seeded.taskId,
				recipientIds: [],
				actorId: seeded.userId,
				oldStatus: "to-do",
				newStatus: "in-progress",
				eventKey: "self-watcher-suppressed",
			},
		);

		expect(result).toBeNull();
	});
});

describe("reply comment notification paths", () => {
	test("_notifyCommentReplied delivers notification to parent comment author", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const parentAuthorId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Reply comp",
				description: "",
				compStart: "2026-05-01",
				compEnd: "2026-05-02",
				organiserIds: [actorId, parentAuthorId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: parentAuthorId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-R01",
				title: "Reply task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const commentId = await ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${taskId}`,
				authorId: actorId,
				content: "reply comment",
				reactions: [],
				updatedAt: Date.now(),
			});
			return { actorId, parentAuthorId, taskId, commentId };
		});

		const result = await t.mutation(
			internal.notifications._notifyCommentReplied,
			{
				taskId: seeded.taskId,
				commentId: seeded.commentId,
				recipientIds: [seeded.parentAuthorId],
				actorId: seeded.actorId,
				eventKey: "reply-to-parent",
			},
		);

		expect(result).toBeTruthy();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.parentAuthorId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]?.type).toBe("comment_replied");
	});

	test("_notifyCommentReplied does not notify the reply author themselves", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Self-reply comp",
				description: "",
				compStart: "2026-06-01",
				compEnd: "2026-06-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-R02",
				title: "Self-reply task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const commentId = await ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${taskId}`,
				authorId: userId,
				content: "self-reply",
				reactions: [],
				updatedAt: Date.now(),
			});
			return { userId, taskId, commentId };
		});

		const result = await t.mutation(
			internal.notifications._notifyCommentReplied,
			{
				taskId: seeded.taskId,
				commentId: seeded.commentId,
				recipientIds: [seeded.userId],
				actorId: seeded.userId,
				eventKey: "self-reply-suppressed",
			},
		);

		expect(result).toBeNull();
	});
});

describe("relation notification batch fan-out", () => {
	test("_notifyTaskRelationBlocked delivers to multiple recipients via recipientIds", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientA = await ctx.db.insert("users", {});
			const recipientB = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Relation comp",
				description: "",
				compStart: "2026-07-01",
				compEnd: "2026-07-02",
				organiserIds: [actorId, recipientA, recipientB],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: recipientA,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: recipientB,
			});
			const blockedTaskId = await ctx.db.insert("tasks", {
				identifier: "HQ-BL1",
				title: "Blocked task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			const blockingTaskId = await ctx.db.insert("tasks", {
				identifier: "HQ-BL2",
				title: "Blocking task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { actorId, recipientA, recipientB, blockedTaskId, blockingTaskId };
		});

		await t.mutation(internal.notifications._notifyTaskRelationBlocked, {
			blockedTaskId: seeded.blockedTaskId,
			blockingTaskId: seeded.blockingTaskId,
			recipientIds: [seeded.recipientA, seeded.recipientB],
			actorId: seeded.actorId,
			eventKey: "relation-batch",
		});

		const notificationsA = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.recipientA).eq("status", "unread"),
				)
				.collect(),
		);
		const notificationsB = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.recipientB).eq("status", "unread"),
				)
				.collect(),
		);

		expect(notificationsA).toHaveLength(1);
		expect(notificationsA[0]?.type).toBe("relation_blocked");
		expect(notificationsB).toHaveLength(1);
		expect(notificationsB[0]?.type).toBe("relation_blocked");
	});

	test("_notifyTaskApproved delivers to assignee and skips self-action", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const assigneeId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Approval comp",
				description: "",
				compStart: "2026-07-01",
				compEnd: "2026-07-02",
				organiserIds: [actorId, assigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-701",
				title: "Needs approval",
				description: "",
				status: "awaiting-review",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: assigneeId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { actorId, assigneeId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskApproved,
			{
				taskId: seeded.taskId,
				recipientIds: [seeded.assigneeId],
				actorId: seeded.actorId,
				eventKey: "approve-test",
			},
		);
		expect(result).not.toBeNull();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.assigneeId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]?.type).toBe("task_approved");
	});

	test("_notifyTaskApproved skips when actor is the only recipient", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Self approve comp",
				description: "",
				compStart: "2026-07-01",
				compEnd: "2026-07-02",
				organiserIds: [userId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-702",
				title: "Self approval",
				description: "",
				status: "awaiting-review",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: userId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { userId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyTaskApproved,
			{
				taskId: seeded.taskId,
				recipientIds: [seeded.userId],
				actorId: seeded.userId,
				eventKey: "self-approve",
			},
		);
		expect(result).toBeNull();
	});

	test("_notifyDueDateChanged delivers to assignee", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const assigneeId = await ctx.db.insert("users", {});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Due date comp",
				description: "",
				compStart: "2026-07-01",
				compEnd: "2026-07-02",
				organiserIds: [actorId, assigneeId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: actorId,
			});
			await ctx.db.insert("competitionAccess", {
				competitionId,
				userId: assigneeId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-703",
				title: "Due date task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: competitionId,
				assigneeId: assigneeId,
				labelIds: [],
				updatedAt: Date.now(),
			});
			return { actorId, assigneeId, taskId };
		});

		const result = await t.mutation(
			internal.notifications._notifyDueDateChanged,
			{
				taskId: seeded.taskId,
				recipientIds: [seeded.assigneeId],
				actorId: seeded.actorId,
				oldDueDate: "2026-01-01",
				newDueDate: "2026-02-01",
				eventKey: "due-date-test",
			},
		);
		expect(result).not.toBeNull();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", seeded.assigneeId).eq("status", "unread"),
				)
				.collect(),
		);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]?.type).toBe("due_date_changed");
	});

	test("_processDispatch marks a due pending dispatch as skipped", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const eventId = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-1",
				idempotencyKey: "dispatch-single",
				threadKey: "task:1",
				dedupeKey: "task_assigned:task:1",
				createdAt: Date.now(),
			});
			const dispatchId = await ctx.db.insert("notificationDispatches", {
				eventId,
				userId,
				channel: "in_app",
				status: "pending",
				digestMode: "immediate",
				scheduledFor: Date.now() - 1_000,
				attempts: 0,
				updatedAt: Date.now(),
			});
			return { dispatchId, eventId };
		});

		const processed = await t.mutation(
			internal.notifications._processDispatch,
			{
				dispatchId: seeded.dispatchId,
			},
		);
		expect(processed).toBe(1);

		const dispatch = await t.run((ctx) =>
			ctx.db.get("notificationDispatches", seeded.dispatchId),
		);
		expect(dispatch?.status).toBe("skipped");
		expect(dispatch?.reason).toBe("channel_not_implemented");
		expect(dispatch?.attempts).toBe(1);
		expect(dispatch?.scheduledFunctionId).toBeUndefined();
		expect(typeof dispatch?.lastAttemptAt).toBe("number");
		expect(typeof dispatch?.metadataJson).toBe("string");

		const metadata = JSON.parse(dispatch?.metadataJson ?? "{}") as {
			eventIds?: Id<"notificationEvents">[];
			eventCount?: number;
		};
		expect(metadata.eventCount).toBe(1);
		expect(metadata.eventIds).toEqual([seeded.eventId]);
	});

	test("_processDispatch processes grouped due digest dispatches together", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {});
			const eventA = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-a",
				idempotencyKey: "dispatch-group-a",
				threadKey: "task:a",
				dedupeKey: "task_assigned:task:a",
				createdAt: Date.now(),
			});
			const eventB = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-b",
				idempotencyKey: "dispatch-group-b",
				threadKey: "task:b",
				dedupeKey: "task_assigned:task:b",
				createdAt: Date.now(),
			});
			const dispatchA = await ctx.db.insert("notificationDispatches", {
				eventId: eventA,
				userId,
				channel: "in_app",
				status: "pending",
				digestMode: "daily",
				digestWindowKey: "2026-01-02:daily",
				scheduledFor: Date.now() - 1_000,
				attempts: 0,
				updatedAt: Date.now(),
			});
			const dispatchB = await ctx.db.insert("notificationDispatches", {
				eventId: eventB,
				userId,
				channel: "in_app",
				status: "pending",
				digestMode: "daily",
				digestWindowKey: "2026-01-02:daily",
				scheduledFor: Date.now() - 1_000,
				attempts: 0,
				updatedAt: Date.now(),
			});
			return { dispatchA, dispatchB };
		});

		const processed = await t.mutation(
			internal.notifications._processDispatch,
			{
				dispatchId: seeded.dispatchA,
			},
		);
		expect(processed).toBe(2);

		const [dispatchA, dispatchB] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("notificationDispatches", seeded.dispatchA),
				ctx.db.get("notificationDispatches", seeded.dispatchB),
			]),
		);

		expect(dispatchA?.status).toBe("skipped");
		expect(dispatchB?.status).toBe("skipped");
		expect(dispatchA?.attempts).toBe(1);
		expect(dispatchB?.attempts).toBe(1);
		expect(dispatchA?.reason).toBe("channel_not_implemented");
		expect(dispatchB?.reason).toBe("channel_not_implemented");
		expect(dispatchA?.metadataJson).toBe(dispatchB?.metadataJson);
	});

	test("_processDispatch claims grouped email dispatches and avoids duplicate processing", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "digest-test@example.com",
			});
			const eventA = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-email-a",
				idempotencyKey: "dispatch-email-group-a",
				threadKey: "task:email-a",
				dedupeKey: "task_assigned:task:email-a",
				createdAt: Date.now(),
			});
			const eventB = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-email-b",
				idempotencyKey: "dispatch-email-group-b",
				threadKey: "task:email-b",
				dedupeKey: "task_assigned:task:email-b",
				createdAt: Date.now(),
			});
			const dispatchA = await ctx.db.insert("notificationDispatches", {
				eventId: eventA,
				userId,
				channel: "email",
				status: "pending",
				digestMode: "daily",
				digestWindowKey: "2026-01-02:daily",
				scheduledFor: Date.now() - 1_000,
				attempts: 0,
				updatedAt: Date.now(),
			});
			const dispatchB = await ctx.db.insert("notificationDispatches", {
				eventId: eventB,
				userId,
				channel: "email",
				status: "pending",
				digestMode: "daily",
				digestWindowKey: "2026-01-02:daily",
				scheduledFor: Date.now() - 1_000,
				attempts: 0,
				updatedAt: Date.now(),
			});
			return { dispatchA, dispatchB };
		});

		const firstProcessed = await t.mutation(
			internal.notifications._processDispatch,
			{
				dispatchId: seeded.dispatchA,
			},
		);
		expect(firstProcessed).toBe(2);

		const [claimedA, claimedB] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("notificationDispatches", seeded.dispatchA),
				ctx.db.get("notificationDispatches", seeded.dispatchB),
			]),
		);
		expect(claimedA?.status).toBe("pending");
		expect(claimedB?.status).toBe("pending");
		expect(claimedA?.reason?.startsWith("email_group_claim:")).toBe(true);
		expect(claimedA?.reason).toBe(claimedB?.reason);
		expect(claimedA?.scheduledFunctionId).toBeDefined();
		expect(claimedA?.scheduledFunctionId).toBe(claimedB?.scheduledFunctionId);

		const secondProcessed = await t.mutation(
			internal.notifications._processDispatch,
			{
				dispatchId: seeded.dispatchB,
			},
		);
		expect(secondProcessed).toBe(0);
	});
});
