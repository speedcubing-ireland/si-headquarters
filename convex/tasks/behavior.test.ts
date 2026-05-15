import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function seedUserAndCompetition(
	t: ReturnType<typeof convexTest>,
): Promise<{ userId: Id<"users">; competitionId: Id<"competitions"> }> {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-01-01",
			compEnd: "2026-01-02",
			organiserIds: [userId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId,
		});
		return { userId, competitionId };
	});
}

describe("tasks behavior characterization", () => {
	test("create allows non-volunteers to create standalone tasks", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		const taskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Task without competition",
			status: "to-do",
			priority: "medium",
		});
		const task = await t.run((ctx) => ctx.db.get("tasks", taskId));

		expect(task?.parentCompetitionId).toBeUndefined();
		expect(task?.ownerType).toBe("user");
		expect(task?.ownerId).toBe(userId);
		expect(task?.assigneeId).toBe(userId);
	});

	test("create generates incremental HQ identifiers", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedUserAndCompetition(t);
		const authed = t.withIdentity({ subject: userId });

		const firstId = await authed.mutation(api.tasks.mutations.create, {
			title: "First task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: competitionId,
		});
		const secondId = await authed.mutation(api.tasks.mutations.create, {
			title: "Second task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: competitionId,
		});

		const [firstDoc, secondDoc] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("tasks", firstId),
				ctx.db.get("tasks", secondId),
			]),
		);

		expect(firstDoc?.identifier).toBe("HQ-1");
		expect(secondDoc?.identifier).toBe("HQ-2");
	});

	test("create triggers due-date notification immediately when due date is set to today", async () => {
		vi.useFakeTimers();
		try {
			const t = convexTest(schema, modules);
			const { userId, competitionId } = await seedUserAndCompetition(t);
			const authed = t.withIdentity({ subject: userId });
			const now = Date.UTC(2026, 0, 15, 9, 0, 0);
			vi.setSystemTime(now);

			await authed.mutation(api.tasks.mutations.create, {
				title: "Due today task",
				status: "to-do",
				priority: "medium",
				parentCompetitionId: competitionId,
				assigneeId: userId,
				dueDate: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
			});
			await t.finishAllScheduledFunctions(() => {
				vi.runAllTimers();
			});

			const notifications = await t.run((ctx) =>
				ctx.db
					.query("notifications")
					.withIndex("by_user_and_status", (q) =>
						q.eq("userId", userId).eq("status", "unread"),
					)
					.collect(),
			);

			expect(
				notifications.some((n) => n.type === "due_date_approaching"),
			).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	test("update auto-promotes awaiting-review to done when approvals are already complete", async () => {
		vi.useFakeTimers();
		try {
			const t = convexTest(schema, modules);
			const seeded = await t.run(async (ctx) => {
				const actorId = await ctx.db.insert("users", {});
				const reviewerId = await ctx.db.insert("users", {});
				const competitionId = await ctx.db.insert("competitions", {
					name: "Comp",
					description: "",
					compStart: "2026-02-01",
					compEnd: "2026-02-02",
					organiserIds: [actorId],
					updatedAt: Date.now(),
				});
				await ctx.db.insert("competitionAccess", {
					competitionId,
					userId: actorId,
				});
				const taskId = await ctx.db.insert("tasks", {
					identifier: "HQ-10",
					title: "Needs approval",
					description: "",
					status: "in-progress",
					priority: "high",
					archived: false,
					parentCompetitionId: competitionId,
					labelIds: [],
					requiredApprovalIds: [`user:${reviewerId}`],
					approvedByIds: [reviewerId],
					updatedAt: Date.now(),
				});
				return { actorId, taskId };
			});
			const authed = t.withIdentity({ subject: seeded.actorId });

			await authed.mutation(api.tasks.mutations.update, {
				taskId: seeded.taskId,
				updates: { status: "awaiting-review" },
			});
			await t.finishAllScheduledFunctions(() => {
				vi.runAllTimers();
			});

			const updatedTask = await t.run((ctx) =>
				ctx.db.get("tasks", seeded.taskId),
			);
			expect(updatedTask?.status).toBe("done");
		} finally {
			vi.useRealTimers();
		}
	});

	test("bulkUpdate rejects requests above MAX_BULK_UPDATE_COUNT", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedUserAndCompetition(t);
		const authed = t.withIdentity({ subject: userId });

		const taskId = await authed.mutation(api.tasks.mutations.create, {
			title: "Anchor task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: competitionId,
		});

		await expect(
			authed.mutation(api.tasks.mutations.bulkUpdate, {
				taskIds: Array.from({ length: 101 }, () => taskId),
				updates: { priority: "low" },
			}),
		).rejects.toBeTruthy();
	});

	test("update blocks moving a task into an inaccessible competition", async () => {
		const t = convexTest(schema, modules);
		const seeded = await t.run(async (ctx) => {
			const actorId = await ctx.db.insert("users", {});
			const otherUserId = await ctx.db.insert("users", {});

			const allowedCompetitionId = await ctx.db.insert("competitions", {
				name: "Allowed",
				description: "",
				compStart: "2026-03-01",
				compEnd: "2026-03-02",
				organiserIds: [actorId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId: allowedCompetitionId,
				userId: actorId,
			});
			const deniedCompetitionId = await ctx.db.insert("competitions", {
				name: "Denied",
				description: "",
				compStart: "2026-04-01",
				compEnd: "2026-04-02",
				organiserIds: [otherUserId],
				updatedAt: Date.now(),
			});
			await ctx.db.insert("competitionAccess", {
				competitionId: deniedCompetitionId,
				userId: otherUserId,
			});
			const taskId = await ctx.db.insert("tasks", {
				identifier: "HQ-20",
				title: "Movable task",
				description: "",
				status: "to-do",
				priority: "medium",
				archived: false,
				parentCompetitionId: allowedCompetitionId,
				labelIds: [],
				updatedAt: Date.now(),
			});

			return { actorId, taskId, deniedCompetitionId };
		});

		const authed = t.withIdentity({ subject: seeded.actorId });

		await expect(
			authed.mutation(api.tasks.mutations.update, {
				taskId: seeded.taskId,
				updates: { parentCompetitionId: seeded.deniedCompetitionId },
			}),
		).rejects.toBeTruthy();
	});

	test("createManyFromTemplate links resolved action short IDs and reports missing ones", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedUserAndCompetition(t);
		const authed = t.withIdentity({ subject: userId });
		const definitionId = await t.run((ctx) =>
			ctx.db.insert("linkedActionDefinitions", {
				name: "Check-in Sheet",
				shortId: "sheet.populate-checkin",
				type: "linked_sheet",
				runPermission: "anyone",
				config: { operation: "populate_checkin_sheet" },
				archived: false,
				createdById: userId,
				updatedById: userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		);

		const result = await authed.mutation(
			api.tasks.mutations.createManyFromTemplate,
			{
				competitionId,
				tasks: [
					{
						tempId: "task-1",
						title: "Check-in task",
						status: "to-do",
						priority: "medium",
						labelIds: [],
						linkedActionShortIds: [
							"sheet.populate-checkin",
							"sheet.missing-action",
						],
					},
				],
			},
		);

		expect(result.taskIds).toHaveLength(1);
		expect(result.missingLinkedActionShortIds).toEqual([
			"sheet.missing-action",
		]);

		const linkedRows = await t.run((ctx) =>
			ctx.db
				.query("taskLinkedActions")
				.withIndex("by_task", (q) => q.eq("taskId", result.taskIds[0]))
				.collect(),
		);
		expect(linkedRows).toHaveLength(1);
		expect(linkedRows[0].linkedActionId).toBe(definitionId);
	});
});
