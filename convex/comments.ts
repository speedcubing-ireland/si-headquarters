import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./auth";

const parentType = v.union(v.literal("task"), v.literal("update"));

const userShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
});

const reactionShape = v.object({
	emoji: v.string(),
	users: v.array(userShape),
});

const commentForUIReturns = v.object({
	id: v.string(),
	parentType,
	parentId: v.string(),
	parentCommentId: v.union(v.string(), v.null()),
	author: userShape,
	content: v.string(),
	createdAt: v.string(),
	updatedAt: v.string(),
	reactions: v.array(reactionShape),
});

export const listForUI = query({
	args: {
		parentType,
		parentId: v.string(),
	},
	returns: v.array(commentForUIReturns),
	handler: async (ctx, args) => {
		// Require authentication to view comments.
		await requireUserId(ctx);
		const docs = await ctx.db
			.query("comments")
			.withIndex("by_parent", (q) =>
				q.eq("parentType", args.parentType).eq("parentId", args.parentId),
			)
			.order("asc")
			.collect();

		const authorIds = new Set<Id<"users">>();
		const reactionUserIds = new Set<Id<"users">>();
		for (const d of docs) {
			authorIds.add(d.authorId);
			for (const r of d.reactions) {
				for (const uid of r.userIds) reactionUserIds.add(uid);
			}
		}
		const allUserIds = new Set([...authorIds, ...reactionUserIds]);
		const userArr = [...allUserIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
		>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const toISO = (ms: number) => new Date(ms).toISOString();

		return docs.map((d) => ({
			id: d._id,
			parentType: d.parentType,
			parentId: d.parentId,
			parentCommentId: d.parentCommentId ?? null,
			author: usersMap.get(d.authorId) ?? {
				id: d.authorId,
				name: "",
				avatarUrl: "",
			},
			content: d.content,
			createdAt: toISO(d._creationTime),
			updatedAt: toISO(d.updatedAt),
			reactions: d.reactions.map((r) => ({
				emoji: r.emoji,
				users: r.userIds
					.map((uid) => usersMap.get(uid))
					.filter((u): u is { id: string; name: string; avatarUrl: string } =>
						Boolean(u),
					),
			})),
		}));
	},
});

export const create = mutation({
	args: {
		parentType,
		parentId: v.string(),
		parentCommentId: v.optional(v.id("comments")),
		authorId: v.id("users"),
		content: v.string(),
	},
	returns: v.id("comments"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		// Enforce that the author is the authenticated user.
		if (args.authorId !== userId) {
			throw new ConvexError("Cannot create a comment as another user");
		}
		const now = Date.now();
		return await ctx.db.insert("comments", {
			parentType: args.parentType,
			parentId: args.parentId,
			parentCommentId: args.parentCommentId,
			authorId: args.authorId,
			content: args.content,
			reactions: [],
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		commentId: v.id("comments"),
		content: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc || doc.authorId !== userId) return null;
		await ctx.db.patch("comments", args.commentId, {
			content: args.content,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const remove = mutation({
	args: { commentId: v.id("comments") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc || doc.authorId !== userId) return null;
		await ctx.db.delete("comments", args.commentId);
		return null;
	},
});

export const listRecentForSearch = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(commentForUIReturns),
	handler: async (ctx, args) => {
		// Require authentication to access recent comments for search.
		await requireUserId(ctx);
		const limit = args.limit ?? 100;
		const docs = await ctx.db.query("comments").order("desc").take(limit);

		const authorIds = new Set<Id<"users">>();
		const reactionUserIds = new Set<Id<"users">>();
		for (const d of docs) {
			authorIds.add(d.authorId);
			for (const r of d.reactions) {
				for (const uid of r.userIds) reactionUserIds.add(uid);
			}
		}
		const allUserIds = new Set([...authorIds, ...reactionUserIds]);
		const userArr = [...allUserIds];
		const userDocs = await Promise.all(
			userArr.map((id) => ctx.db.get("users", id)),
		);
		const usersMap = new Map<
			string,
			{ id: string; name: string; avatarUrl: string }
		>();
		userArr.forEach((id, i) => {
			const u = userDocs[i];
			if (u)
				usersMap.set(id, {
					id,
					name: u.name ?? "",
					avatarUrl: u.image ?? "",
				});
		});

		const toISO = (ms: number) => new Date(ms).toISOString();

		return docs.map((d) => ({
			id: d._id,
			parentType: d.parentType,
			parentId: d.parentId,
			parentCommentId: d.parentCommentId ?? null,
			author: usersMap.get(d.authorId) ?? {
				id: d.authorId,
				name: "",
				avatarUrl: "",
			},
			content: d.content,
			createdAt: toISO(d._creationTime),
			updatedAt: toISO(d.updatedAt),
			reactions: d.reactions.map((r) => ({
				emoji: r.emoji,
				users: r.userIds
					.map((uid) => usersMap.get(uid))
					.filter((u): u is { id: string; name: string; avatarUrl: string } =>
						Boolean(u),
					),
			})),
		}));
	},
});

export const toggleReaction = mutation({
	args: {
		commentId: v.id("comments"),
		emoji: v.string(),
		userId: v.id("users"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc) return null;

		// Ensure the reacting user is the authenticated user.
		if (args.userId !== userId) {
			throw new ConvexError("Cannot react on behalf of another user");
		}

		const reactions = [...doc.reactions];
		const idx = reactions.findIndex((r) => r.emoji === args.emoji);
		if (idx >= 0) {
			const userIds = [...reactions[idx].userIds];
			const userIdx = userIds.indexOf(args.userId);
			if (userIdx >= 0) {
				userIds.splice(userIdx, 1);
				if (userIds.length === 0) reactions.splice(idx, 1);
				else reactions[idx] = { ...reactions[idx], userIds };
			} else {
				userIds.push(args.userId);
				reactions[idx] = { ...reactions[idx], userIds };
			}
		} else {
			reactions.push({ emoji: args.emoji, userIds: [args.userId] });
		}

		await ctx.db.patch("comments", args.commentId, {
			reactions,
			updatedAt: Date.now(),
		});
		return null;
	},
});
