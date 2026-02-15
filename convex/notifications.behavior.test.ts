import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { emitNotificationEvent } from "./notifications";
import schema from "./schema";
import { modules } from "./test.setup";

process.env.AZURE_EMAIL_CONNECTION_STRING ??=
	"endpoint=https://example.communication.azure.com/;accesskey=test";
process.env.EMAIL_SENDER_ADDRESS ??= "noreply@example.com";

describe("notifications behavior", () => {
	test("listForUser excludes notifications scheduled in the future", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.insert("notifications", {
				userId: me,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Visible",
				message: "Visible",
				entityType: "task",
				entityId: "task-visible",
				metadata: {},
				scheduledFor: now - 1_000,
				isBatchable: false,
			});
			await ctx.db.insert("notifications", {
				userId: me,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Hidden",
				message: "Hidden",
				entityType: "task",
				entityId: "task-hidden",
				metadata: {},
				scheduledFor: now + 60_000,
				isBatchable: false,
			});
		});

		const rows = await authed.query(api.notifications.listForUser, {
			limit: 50,
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.title).toBe("Visible");
	});

	test("getUnreadCount ignores snoozed and future-scheduled unread notifications", async () => {
		const t = convexTest(schema, modules);
		const me = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: me });

		const now = Date.now();
		await t.run(async (ctx) => {
			await ctx.db.insert("notifications", {
				userId: me,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Count me",
				message: "Count me",
				entityType: "task",
				entityId: "task-1",
				metadata: {},
				isBatchable: false,
			});
			await ctx.db.insert("notifications", {
				userId: me,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Snoozed",
				message: "Snoozed",
				entityType: "task",
				entityId: "task-2",
				metadata: {},
				snoozedUntil: now + 60_000,
				isBatchable: false,
			});
			await ctx.db.insert("notifications", {
				userId: me,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Scheduled",
				message: "Scheduled",
				entityType: "task",
				entityId: "task-3",
				metadata: {},
				scheduledFor: now + 60_000,
				isBatchable: false,
			});
		});

		const unreadCount = await authed.query(
			api.notifications.getUnreadCount,
			{},
		);
		expect(unreadCount).toBe(1);
	});

	test("upsertPreference keeps in_app digest mode as immediate", async () => {
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
		const inApp = preferences.find(
			(row) => row.type === "task_assigned" && row.channel === "in_app",
		);
		expect(inApp?.digestMode).toBe("immediate");
	});

	test("emitNotificationEvent(task_assigned) suppresses actor self-notifications", async () => {
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

		const result = await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.userId,
				actorId: seeded.userId,
				eventKey: "self-action",
			}),
		);
		expect(result).toBeNull();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user", (q) => q.eq("userId", seeded.userId))
				.collect(),
		);
		expect(notifications).toHaveLength(0);
	});

	test("emitNotificationEvent(task_assigned) skips recipients without access", async () => {
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

		const result = await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "no-access",
			}),
		);
		expect(result).toBeNull();

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user", (q) => q.eq("userId", seeded.recipientId))
				.collect(),
		);
		expect(notifications).toHaveLength(0);
	});

	test("emitNotificationEvent(competition_phase_changed) delivers for recipients with access", async () => {
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

		const notificationId = await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "competition_phase_changed",
				competitionId: seeded.competitionId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				oldPhaseName: "Planning",
				newPhaseName: "Execution",
				eventKey: "phase-delivery",
			}),
		);
		expect(notificationId).toBeTruthy();
	});

	test("_composeNotificationEmailStageGroup creates one unified email dispatch", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "stage-user@example.com",
				name: "Stage User",
			});
			const eventId = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-stage",
				idempotencyKey: "stage-event-1",
				threadKey: "task:task-stage",
				dedupeKey: "task_assigned:task-stage",
				createdAt: Date.now(),
			});
			const notificationId = await ctx.db.insert("notifications", {
				userId,
				type: "task_assigned",
				priority: "normal",
				status: "unread",
				title: "Task assigned",
				message: "You were assigned a task",
				entityType: "task",
				entityId: "task-stage",
				metadata: {},
				sourceEventId: eventId,
				isBatchable: false,
			});
			const stageId = await ctx.db.insert("notificationEmailStageItems", {
				stageKey: `${eventId}:${userId}`,
				userId,
				notificationId,
				eventId,
				digestMode: "immediate",
				digestWindowKey: undefined,
				scheduledFor: Date.now() - 1_000,
				status: "pending",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { userId, stageId };
		});

		const composed = await t.mutation(
			internal.notifications._composeNotificationEmailStageGroup,
			{
				userId: seeded.userId,
				digestMode: "immediate",
				digestWindowKey: undefined,
			},
		);
		expect(composed.staged).toBe(1);

		const [stageRow, emailDispatches] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("notificationEmailStageItems", seeded.stageId),
				ctx.db
					.query("emailDispatches")
					.withIndex("by_source_status_created_at", (q) =>
						q.eq("sourceKind", "notification").eq("status", "queued"),
					)
					.collect(),
			]),
		);

		expect(stageRow?.status).toBe("composed");
		expect(stageRow?.emailDispatchId).toBeDefined();
		expect(emailDispatches).toHaveLength(1);
		expect(emailDispatches[0]?.recipientEmail).toBe("stage-user@example.com");
	});

	test("dispatch diagnostics queries require director access", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await expect(
			authed.query(api.notifications.getDispatchHealth, {}),
		).rejects.toBeTruthy();
		await expect(
			authed.query(api.notifications.listRecentDeadLetters, {}),
		).rejects.toBeTruthy();
	});

	test("director can read unified queue diagnostics", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const directorId = await ctx.db.insert("users", {
				email: "director@example.com",
			});
			await ctx.db.insert("teams", {
				name: "Directors",
				memberIds: [directorId],
			});

			const dispatchId = await ctx.db.insert("emailDispatches", {
				dedupeKey: "diag:1",
				sourceKind: "notification",
				sourceRef: "diag",
				templateKey: "notification_immediate",
				recipientEmail: "director@example.com",
				subject: "Diagnostic",
				plainTextBody: "Diagnostic",
				scheduledFor: Date.now(),
				status: "dead_letter",
				providerOperationId: "diag-provider-op",
				sendAttemptCount: 1,
				pollAttemptCount: 0,
				deadLetteredAt: Date.now(),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});

			await ctx.db.insert("emailDeadLetters", {
				dispatchId,
				dedupeKey: "diag:1",
				sourceKind: "notification",
				sourceRef: "diag",
				templateKey: "notification_immediate",
				recipientEmail: "director@example.com",
				subject: "Diagnostic",
				error: "smtp_rejected",
				providerOperationId: "diag-provider-op",
				sendAttemptCount: 1,
				pollAttemptCount: 0,
				failedAt: Date.now(),
				replayCount: 0,
			});

			return { directorId };
		});

		const director = t.withIdentity({ subject: seeded.directorId });
		const [health, deadLetters] = await Promise.all([
			director.query(api.notifications.getDispatchHealth, {}),
			director.query(api.notifications.listRecentDeadLetters, {
				channel: "email",
				limit: 10,
			}),
		]);

		expect(health.totals.failed).toBe(1);
		expect(
			health.byChannel.some(
				(row: { channel: string }) => row.channel === "email",
			),
		).toBe(true);
		expect(health.deadLettersLast24h).toBe(1);
		expect(deadLetters).toHaveLength(1);
		expect(deadLetters[0]?.error).toBe("smtp_rejected");
	});
});
