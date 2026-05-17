import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TEAM_NAMES } from "../lib/constants";

async function seedTaskForComments(t: ReturnType<typeof convexTest>): Promise<{
	authorId: Id<"users">;
	otherId: Id<"users">;
	competitionId: Id<"competitions">;
	taskId: Id<"tasks">;
}> {
	return t.run(async (ctx) => {
		const authorId = await ctx.db.insert("users", {});
		const otherId = await ctx.db.insert("users", {});
		await ctx.db.insert("teams", {
			name: TEAM_NAMES.VOLUNTEER,
			memberIds: [authorId, otherId],
		});
		const competitionId = await ctx.db.insert("competitions", {
			name: "Comp",
			description: "",
			compStart: "2026-08-01",
			compEnd: "2026-08-02",
			organiserIds: [authorId, otherId],
			updatedAt: Date.now(),
		});
		for (const uid of [authorId, otherId]) {
			await ctx.db.insert("competitionAccess", { competitionId, userId: uid });
		}
		const taskId = await ctx.db.insert("tasks", {
			identifier: "HQ-600",
			title: "Comment Task",
			description: "",
			status: "to-do",
			priority: "medium",
			archived: false,
			parentCompetitionId: competitionId,
			labelIds: [],
			updatedAt: Date.now(),
		});
		return { authorId, otherId, competitionId, taskId };
	});
}

async function linkDiscordUser(
	t: ReturnType<typeof convexTest>,
	userId: Id<"users">,
) {
	await t.run((ctx) =>
		ctx.db.insert("discordUserLinks", {
			userId,
			guildId: "guild-1",
			discordUserId: `discord-${userId}`,
			discordUsername: "linked-user",
			linkedById: userId,
			linkedAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
}

describe("comments CRUD behavior", () => {
	test("create comment stores record with correct fields", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);
		await linkDiscordUser(t, seeded.otherId);
		const authed = t.withIdentity({ subject: seeded.authorId });

		const commentId = await authed.mutation(api.comments.api.create, {
			parentType: "task",
			parentId: `${seeded.taskId}`,
			content: "First comment",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", commentId));
		expect(doc?.parentType).toBe("task");
		expect(doc?.parentId).toBe(`${seeded.taskId}`);
		expect(doc?.authorId).toBe(seeded.authorId);
		expect(doc?.content).toBe("First comment");
		expect(doc?.reactions).toEqual([]);
		expect(doc?.parentCommentId).toBeUndefined();
	}, 15_000);

	test("create comment on update stores record with update parentType", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);

		// Create a competition update to comment on
		const updateId = await t.run(async (ctx) =>
			ctx.db.insert("competitionUpdates", {
				competitionId: seeded.competitionId,
				authorId: seeded.authorId,
				status: "on-track",
				message: "Progress",
				reactions: [],
				updatedAt: Date.now(),
			}),
		);

		const authed = t.withIdentity({ subject: seeded.authorId });
		const commentId = await authed.mutation(api.comments.api.create, {
			parentType: "update",
			parentId: `${updateId}`,
			content: "Comment on update",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", commentId));
		expect(doc?.parentType).toBe("update");
		expect(doc?.parentId).toBe(`${updateId}`);
	}, 15_000);

	test("delete comment removes the comment record", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);
		const authed = t.withIdentity({ subject: seeded.authorId });

		const commentId = await authed.mutation(api.comments.api.create, {
			parentType: "task",
			parentId: `${seeded.taskId}`,
			content: "To be deleted",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		await authed.mutation(api.comments.api.remove, { commentId });

		const comment = await t.run((ctx) => ctx.db.get("comments", commentId));
		expect(comment).toBeNull();
	}, 15_000);

	test("delete comment by non-author is rejected", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);
		const authed = t.withIdentity({ subject: seeded.authorId });

		const commentId = await authed.mutation(api.comments.api.create, {
			parentType: "task",
			parentId: `${seeded.taskId}`,
			content: "Only author can delete",
		});
		await t.finishAllScheduledFunctions(() => {
			vi.runAllTimers();
		});

		const other = t.withIdentity({ subject: seeded.otherId });
		await expect(
			other.mutation(api.comments.api.remove, { commentId }),
		).rejects.toBeTruthy();
	}, 15_000);

	test("toggleReaction adds emoji reaction to comment", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);

		const commentId = await t.run(async (ctx) =>
			ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${seeded.taskId}`,
				authorId: seeded.authorId,
				content: "React to me",
				reactions: [],
				updatedAt: Date.now(),
			}),
		);

		const authed = t.withIdentity({ subject: seeded.otherId });
		await authed.mutation(api.comments.api.toggleReaction, {
			commentId,
			emoji: "👍",
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", commentId));
		const thumbsUp = doc?.reactions.find((r) => r.emoji === "👍");
		expect(thumbsUp).toBeTruthy();
		expect(thumbsUp?.userIds).toContain(seeded.otherId);
	});

	test("toggleReaction removes emoji when toggled again", async () => {
		const t = convexTest(schema, modules);
		const seeded = await seedTaskForComments(t);

		const commentId = await t.run(async (ctx) =>
			ctx.db.insert("comments", {
				parentType: "task",
				parentId: `${seeded.taskId}`,
				authorId: seeded.authorId,
				content: "Toggle me",
				reactions: [],
				updatedAt: Date.now(),
			}),
		);

		const authed = t.withIdentity({ subject: seeded.otherId });
		// Toggle on
		await authed.mutation(api.comments.api.toggleReaction, {
			commentId,
			emoji: "🎉",
		});
		// Toggle off
		await authed.mutation(api.comments.api.toggleReaction, {
			commentId,
			emoji: "🎉",
		});

		const doc = await t.run((ctx) => ctx.db.get("comments", commentId));
		const party = doc?.reactions.find((r) => r.emoji === "🎉");
		// Either the reaction entry is removed or the user is not in it
		if (party) {
			expect(party.userIds).not.toContain(seeded.otherId);
		}
	});
});
