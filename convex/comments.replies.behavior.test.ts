import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { TEAM_NAMES } from "./lib/constants";

async function seedTaskWithComment(t: ReturnType<typeof convexTest>): Promise<{
	authorId: Id<"users">;
	replierId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
	commentId: Id<"comments">;
}> {
	return t.run(async (ctx) => {
		const authorId = await ctx.db.insert("users", {});
		const replierId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [authorId, replierId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-08-01",
			compEnd: "2026-08-02",
			organiserIds: [authorId, replierId],
			updatedAt: Date.now(),
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: authorId,
		});
		await ctx.db.insert("competitionAccess", {
			competitionId,
			userId: replierId,
		});
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-500",
			title: "Comment Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			assigneeId: authorId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		const commentId = await ctx.db.insert("comments", {
			parentType: "task",
			parentId: `${taskId}`,
			authorId,
			content: "Original comment",
			reactions: [],
			updatedAt: Date.now(),
		});
		return { authorId, replierId, competitionId, taskId, commentId };
	});
}

describe("comments replies behavior", () => {
	test("reply creates comment with parentCommentId set", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithComment(t);
		const replier = t.withIdentity({ subject: seeded.replierId });

		const replyId = await replier.mutation(api.comments.create, {
			parentType: "task",
			parentId: `${seeded.taskId}`,
			parentCommentId: seeded.commentId,
			content: "This is a reply",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const reply = await t.run((ctx) => ctx.db.get("comments", replyId));
		expect(reply?.parentCommentId).toBe(seeded.commentId);
		expect(reply?.content).toBe("This is a reply");
	}, 15_000);

	test("reply sends comment_replied notification to original author", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithComment(t);
		const replier = t.withIdentity({ subject: seeded.replierId });

		await replier.mutation(api.comments.create, {
			parentType: "task",
			parentId: `${seeded.taskId}`,
			parentCommentId: seeded.commentId,
			content: "Reply to trigger notification",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const notifications = await t.run((ctx) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user", (q) => q.eq("userId", seeded.authorId))
				.collect(),
		);
		expect(
			notifications.some((n) => n.type === "comment_replied"),
		).toBeTruthy();
	}, 15_000);

	test("edit comment sets contentUpdatedAt and changes content", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithComment(t);
		const author = t.withIdentity({ subject: seeded.authorId });

		await author.mutation(api.comments.update, {
			commentId: seeded.commentId,
			content: "Edited content",
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", seeded.commentId));
		expect(doc?.content).toBe("Edited content");
		expect(doc?.contentUpdatedAt).toBeTypeOf("number");
	});

	test("edit by non-author is rejected", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskWithComment(t);
		const replier = t.withIdentity({ subject: seeded.replierId });

		await replier.mutation(api.comments.update, {
			commentId: seeded.commentId,
			content: "Hijacked",
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", seeded.commentId));
		expect(doc?.content).toBe("Original comment");
	});
});
