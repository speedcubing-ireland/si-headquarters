import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
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

	test("immediate stage rows use unique group keys outside quiet hours", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {
				email: "immediate-groups@example.com",
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Immediate groups comp",
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
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-610",
				title: "Immediate scheduling task",
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
			channel: "email",
			enabled: true,
			digestMode: "immediate",
		});

		await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "immediate-group-a",
			}),
		);
		await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "immediate-group-b",
			}),
		);

		const stageRows = await t.run((ctx) =>
			ctx.db.query("notificationEmailStageItems").collect(),
		);
		const recipientRows = stageRows.filter(
			(row) =>
				row.userId === seeded.recipientId && row.digestMode === "immediate",
		);
		const digestWindowKeys = recipientRows.map((row) => row.digestWindowKey);
		const uniqueDigestWindowKeys = new Set(digestWindowKeys);

		expect(recipientRows).toHaveLength(2);
		expect(digestWindowKeys.every((key) => typeof key === "string")).toBe(true);
		expect(uniqueDigestWindowKeys.size).toBe(2);
		expect(
			digestWindowKeys.every(
				(key) => typeof key === "string" && !key.startsWith("quiet:"),
			),
		).toBe(true);
	});

	test("_composeNotificationEmailStageGroup reschedules remaining pending rows", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const now = Date.now();
			const userId = await ctx.db.insert("users", {
				email: "stage-reschedule@example.com",
				name: "Stage Reschedule",
			});
			const eventA = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-stage-a",
				idempotencyKey: "stage-reschedule-a",
				threadKey: "task:task-stage-a",
				dedupeKey: "task_assigned:task-stage-a",
				createdAt: now,
			});
			const eventB = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-stage-b",
				idempotencyKey: "stage-reschedule-b",
				threadKey: "task:task-stage-b",
				dedupeKey: "task_assigned:task-stage-b",
				createdAt: now,
			});
			const digestWindowKey = "quiet:2026-01-10T07:00";
			const dueStageId = await ctx.db.insert("notificationEmailStageItems", {
				stageKey: `${eventA}:${userId}`,
				userId,
				eventId: eventA,
				digestMode: "immediate",
				digestWindowKey,
				scheduledFor: now - 1_000,
				status: "pending",
				metadataJson: JSON.stringify({
					type: "task_assigned",
					title: "Due stage row",
					message: "Due stage row",
					entityType: "task",
					entityId: "task-stage-a",
					priority: "normal",
				}),
				createdAt: now,
				updatedAt: now,
			});
			const futureScheduledFor = now + 60_000;
			const futureStageId = await ctx.db.insert("notificationEmailStageItems", {
				stageKey: `${eventB}:${userId}`,
				userId,
				eventId: eventB,
				digestMode: "immediate",
				digestWindowKey,
				scheduledFor: futureScheduledFor,
				status: "pending",
				metadataJson: JSON.stringify({
					type: "task_assigned",
					title: "Future stage row",
					message: "Future stage row",
					entityType: "task",
					entityId: "task-stage-b",
					priority: "normal",
				}),
				createdAt: now,
				updatedAt: now,
			});
			return {
				userId,
				dueStageId,
				futureStageId,
				digestWindowKey,
				futureScheduledFor,
			};
		});

		const composed = await t.mutation(
			internal.notifications._composeNotificationEmailStageGroup,
			{
				userId: seeded.userId,
				digestMode: "immediate",
				digestWindowKey: seeded.digestWindowKey,
			},
		);
		expect(composed.staged).toBe(1);

		const result = await t.run(async (ctx) => {
			const dueRow = await ctx.db.get(
				"notificationEmailStageItems",
				seeded.dueStageId,
			);
			const futureRow = await ctx.db.get(
				"notificationEmailStageItems",
				seeded.futureStageId,
			);
			const scheduledDoc = futureRow?.scheduledFunctionId
				? await ctx.db.system.get(
						"_scheduled_functions",
						futureRow.scheduledFunctionId,
					)
				: null;
			const queuedDispatches = await ctx.db
				.query("emailDispatches")
				.withIndex("by_source_status_created_at", (q) =>
					q.eq("sourceKind", "notification").eq("status", "queued"),
				)
				.collect();
			return {
				dueRow,
				futureRow,
				scheduledDoc,
				queuedDispatches,
			};
		});

		expect(result.dueRow?.status).toBe("composed");
		expect(result.futureRow?.status).toBe("pending");
		expect(result.futureRow?.scheduledFunctionId).toBeDefined();
		expect(result.scheduledDoc).toBeTruthy();
		expect(result.scheduledDoc?.scheduledTime).toBeGreaterThanOrEqual(
			seeded.futureScheduledFor,
		);
		expect(result.queuedDispatches).toHaveLength(1);
		expect(result.queuedDispatches[0]?.templateKey).toBe("notification_digest");
	});

	test("daily digest stage rows in same group reuse one scheduled function", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const recipientId = await ctx.db.insert("users", {
				email: "digest-schedule@example.com",
			});
			const competitionId = await ctx.db.insert("competitions", {
				name: "Digest scheduling comp",
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
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-600",
				title: "Digest scheduling task",
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
			channel: "email",
			enabled: true,
			digestMode: "daily",
		});

		await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "digest-schedule-a",
			}),
		);
		await t.run((ctx) =>
			emitNotificationEvent(ctx, {
				type: "task_assigned",
				taskId: seeded.taskId,
				recipientId: seeded.recipientId,
				actorId: seeded.actorId,
				eventKey: "digest-schedule-b",
			}),
		);

		const result = await t.run(async (ctx) => {
			const stageRows = await ctx.db
				.query("notificationEmailStageItems")
				.withIndex("by_status_scheduled_for", (q) => q.eq("status", "pending"))
				.collect();
			const recipientRows = stageRows.filter(
				(row) =>
					row.userId === seeded.recipientId && row.digestMode === "daily",
			);
			const scheduledFunctionIds = [
				...new Set(
					recipientRows
						.map((row) => row.scheduledFunctionId)
						.filter((id): id is Id<"_scheduled_functions"> => id !== undefined),
				),
			];
			const scheduledDoc =
				scheduledFunctionIds.length > 0
					? await ctx.db.system.get(
							"_scheduled_functions",
							scheduledFunctionIds[0],
						)
					: null;
			return {
				rowCount: recipientRows.length,
				scheduledFunctionIds,
				hasScheduledDoc: scheduledDoc !== null,
			};
		});

		expect(result.rowCount).toBe(2);
		expect(result.scheduledFunctionIds).toHaveLength(1);
		expect(result.hasScheduledDoc).toBe(true);
	});

	test("_recoverPendingNotificationEmailStages groups due rows and schedules compose jobs", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "recover-user@example.com",
			});
			const eventA = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-recover-a",
				idempotencyKey: "recover-event-a",
				threadKey: "task:task-recover-a",
				dedupeKey: "task_assigned:task-recover-a",
				createdAt: Date.now(),
			});
			const eventB = await ctx.db.insert("notificationEvents", {
				type: "task_assigned",
				entityType: "task",
				entityId: "task-recover-b",
				idempotencyKey: "recover-event-b",
				threadKey: "task:task-recover-b",
				dedupeKey: "task_assigned:task-recover-b",
				createdAt: Date.now(),
			});

			await ctx.db.insert("notificationEmailStageItems", {
				stageKey: `${eventA}:${userId}`,
				userId,
				eventId: eventA,
				digestMode: "immediate",
				digestWindowKey: undefined,
				scheduledFor: Date.now() - 1_000,
				status: "pending",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			await ctx.db.insert("notificationEmailStageItems", {
				stageKey: `${eventB}:${userId}`,
				userId,
				eventId: eventB,
				digestMode: "immediate",
				digestWindowKey: undefined,
				scheduledFor: Date.now() - 1_000,
				status: "pending",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		});

		const result = await t.mutation(
			internal.notifications._recoverPendingNotificationEmailStages,
			{ limit: 100 },
		);
		expect(result.rows).toBe(2);
		expect(result.groups).toBe(1);
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
