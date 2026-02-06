import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function seedCompetitionTaskAndComment(
	t: ReturnType<typeof convexTest>,
): Promise<{
	organiserId: Id<"users">;
	viewerId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
	commentId: Id<"comments">;
}> {
	return t.run(async (ctx) => {
		const organiserId = await ctx.db.insert("users", {});
		const viewerId = await ctx.db.insert("users", {});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-12-20",
			compEnd: "2026-12-21",
			organiserIds: [organiserId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: organiserId,
		});
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-701",
			title: "Task",
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
			authorId: organiserId,
			content: "seed comment",
			reactions: [],
			updatedAt: Date.now(),
		});
		return { organiserId, viewerId, competitionId, taskId, commentId };
	});
}

describe("comments behavior characterization", () => {
	test("listForUI hides comments for non-volunteers without competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);

		const denied = t.withIdentity({ subject: seeded.viewerId });
		const allowed = t.withIdentity({ subject: seeded.organiserId });

		const deniedRows = await denied.query(api.comments.listForUI, {
			parentType: "task",
			parentId: seeded.taskId,
		});
		const allowedRows = await allowed.query(api.comments.listForUI, {
			parentType: "task",
			parentId: seeded.taskId,
		});

		expect(deniedRows).toEqual([]);
		expect(allowedRows).toHaveLength(1);
	}, 15_000);

	test("create sanitizes comment content for accessible task comments", async () => {
		vi.useFakeTimers();
		try {
			const t = convexTest(schema, modules);
			const seeded = await seedCompetitionTaskAndComment(t);
			const authed = t.withIdentity({ subject: seeded.organiserId });

			const commentId = await authed.mutation(api.comments.create, {
				parentType: "task",
				parentId: `${seeded.taskId}`,
				content: "   <hello>   ",
			});
			await t.finishAllScheduledFunctions(() => {
				vi.runAllTimers();
			});

			const comment = await t.run((ctx) => ctx.db.get("comments", commentId));
			expect(comment?.content).toBe("hello");
		} finally {
			vi.useRealTimers();
		}
	}, 15_000);

	test("create rejects non-volunteers without competition access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);
		const denied = t.withIdentity({ subject: seeded.viewerId });

		await expect(
			denied.mutation(api.comments.create, {
				parentType: "task",
				parentId: `${seeded.taskId}`,
				content: "No access",
			}),
		).rejects.toBeTruthy();
	}, 15_000);

	test("remove allows directors to delete others comments and related subscriptions", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);
		const directorId = await t.run((ctx) => ctx.db.insert("users", {}));
		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: "Directors",
				memberIds: [directorId],
			});
			await ctx.db.insert("notificationSubscriptions", {
				userId: directorId,
				subscriptionType: "entity",
				entityType: "comment",
				entityId: `${seeded.commentId}`,
				updatedAt: Date.now(),
			});
		});

		const authedDirector = t.withIdentity({ subject: directorId });
		await authedDirector.mutation(api.comments.remove, {
			commentId: seeded.commentId,
		});

		const [comment, subscriptions] = await t.run((ctx) =>
			Promise.all([
				ctx.db.get("comments", seeded.commentId),
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "comment").eq("entityId", `${seeded.commentId}`),
					)
					.collect(),
			]),
		);
		expect(comment).toBeNull();
		expect(subscriptions).toHaveLength(0);
	}, 15_000);

	test("toggleReaction adds then removes user reaction", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);
		const authed = t.withIdentity({ subject: seeded.organiserId });

		await authed.mutation(api.comments.toggleReaction, {
			commentId: seeded.commentId,
			emoji: "👍",
		});
		let comment = await t.run((ctx) =>
			ctx.db.get("comments", seeded.commentId),
		);
		expect(comment?.reactions).toHaveLength(1);
		expect(comment?.reactions[0]?.emoji).toBe("👍");
		expect(comment?.reactions[0]?.userIds).toEqual([seeded.organiserId]);

		await authed.mutation(api.comments.toggleReaction, {
			commentId: seeded.commentId,
			emoji: "👍",
		});
		comment = await t.run((ctx) => ctx.db.get("comments", seeded.commentId));
		expect(comment?.reactions).toEqual([]);
	});

	test("toggleReaction ignores requests from users without parent access", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);
		const denied = t.withIdentity({ subject: seeded.viewerId });

		await denied.mutation(api.comments.toggleReaction, {
			commentId: seeded.commentId,
			emoji: "👍",
		});

		const comment = await t.run((ctx) =>
			ctx.db.get("comments", seeded.commentId),
		);
		expect(comment?.reactions).toEqual([]);
	});

	test("listRecentForSearch is limited to volunteers", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedCompetitionTaskAndComment(t);
		const denied = t.withIdentity({ subject: seeded.viewerId });
		const volunteer = t.withIdentity({ subject: seeded.organiserId });

		const deniedRows = await denied.query(api.comments.listRecentForSearch, {});
		expect(deniedRows).toEqual([]);

		await t.run(async (ctx) => {
			await ctx.db.insert("teams", {
				name: "Volunteer",
				memberIds: [seeded.organiserId],
			});
		});

		const volunteerRows = await volunteer.query(
			api.comments.listRecentForSearch,
			{
				limit: 20,
			},
		);
		expect(volunteerRows.length).toBeGreaterThan(0);
	});
});
