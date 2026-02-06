import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

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
	test("create requires non-volunteers to link task to a competition", async () => {
		const t = convexTest(schema, modules);
		const userId = await t.run((ctx) => ctx.db.insert("users", {}));
		const authed = t.withIdentity({ subject: userId });

		await expect(
			authed.mutation(api.tasks.create, {
				title: "Task without competition",
				status: "to-do",
				priority: "medium",
			}),
		).rejects.toBeTruthy();
	});

	test("create generates incremental HQ identifiers", async () => {
		const t = convexTest(schema, modules);
		const { userId, competitionId } = await seedUserAndCompetition(t);
		const authed = t.withIdentity({ subject: userId });

		const firstId = await authed.mutation(api.tasks.create, {
			title: "First task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: competitionId,
		});
		const secondId = await authed.mutation(api.tasks.create, {
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

			await authed.mutation(api.tasks.update, {
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

		const taskId = await authed.mutation(api.tasks.create, {
			title: "Anchor task",
			status: "to-do",
			priority: "medium",
			parentCompetitionId: competitionId,
		});

		await expect(
			authed.mutation(api.tasks.bulkUpdate, {
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
			authed.mutation(api.tasks.update, {
				taskId: seeded.taskId,
				updates: { parentCompetitionId: seeded.deniedCompetitionId },
			}),
		).rejects.toBeTruthy();
	});
});
