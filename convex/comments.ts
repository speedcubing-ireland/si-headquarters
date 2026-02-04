import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";
import { internal } from "./_generated/api";
import { isDirectorForCtx } from "./admin";

const parentType = v.union(v.literal("task"), v.literal("update"));

const ERROR_COMMENT_NO_ACCESS_TASK =
	"You can only comment on tasks linked to competitions you are organizing";
const ERROR_COMMENT_NO_ACCESS_UPDATE =
	"You can only comment on updates for competitions you are organizing";

async function hasCompetitionAccess(
	ctx: QueryCtx | MutationCtx,
	isVolunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions"> | string | null | undefined,
): Promise<boolean> {
	if (isVolunteer) return true;
	if (!competitionId) return false;

	const competition = await ctx.db.get(
		"competitions",
		competitionId as Id<"competitions">,
	);
	if (!competition) return false;

	return (
		competition.organiserIds.includes(userId) ||
		competition.compLeadId === userId ||
		competition.leadDelegateId === userId
	);
}

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
	contentUpdatedAt: v.optional(v.string()),
	reactions: v.array(reactionShape),
});

export const listForUI = query({
	args: {
		parentType,
		parentId: v.string(),
	},
	returns: v.array(commentForUIReturns),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);

		if (args.parentType === "task") {
			const task = await ctx.db.get("tasks", args.parentId as Id<"tasks">);
			if (!task) return [];

			if (!volunteer) {
				if (!task.parentCompetitionId) return [];
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					task.parentCompetitionId,
				);
				if (!hasAccess) return [];
			}
		} else if (args.parentType === "update") {
			const update = await ctx.db.get(
				"competitionUpdates",
				args.parentId as Id<"competitionUpdates">,
			);
			if (!update) return [];

			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					update.competitionId,
				);
				if (!hasAccess) return [];
			}
		}

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
			contentUpdatedAt:
				d.contentUpdatedAt != null ? toISO(d.contentUpdatedAt) : undefined,
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

function matchesMention(
	mentionedNames: Set<string>,
	userName: string,
	userEmail: string,
): boolean {
	const normalizedName = userName.toLowerCase();
	const normalizedEmail = userEmail.toLowerCase();
	const firstName = normalizedName.split(" ")[0];
	const lastName = normalizedName.split(" ").pop() ?? "";

	return (
		mentionedNames.has(normalizedName) ||
		mentionedNames.has(normalizedEmail) ||
		(Boolean(firstName) && mentionedNames.has(firstName)) ||
		(Boolean(lastName) && mentionedNames.has(lastName))
	);
}

async function extractMentions(
	ctx: {
		db: {
			query: (table: "users") => {
				collect: () => Promise<
					Array<{ _id: Id<"users">; name?: string; email?: string }>
				>;
			};
		};
	},
	content: string,
): Promise<Id<"users">[]> {
	const mentionRegex = /@(\w+)/g;
	const matches = Array.from(content.matchAll(mentionRegex));
	if (matches.length === 0) return [];

	const mentionedNames = new Set(matches.map((m) => m[1].toLowerCase()));
	const allUsers = await ctx.db.query("users").collect();
	const mentionedUserIds: Id<"users">[] = [];

	for (const user of allUsers) {
		const userName = (user.name ?? "").toLowerCase();
		const userEmail = (user.email ?? "").toLowerCase().split("@")[0];
		if (matchesMention(mentionedNames, userName, userEmail)) {
			mentionedUserIds.push(user._id);
		}
	}

	return mentionedUserIds;
}

export const create = mutation({
	args: {
		parentType,
		parentId: v.string(),
		parentCommentId: v.optional(v.id("comments")),
		content: v.string(),
	},
	returns: v.id("comments"),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const volunteer = await isVolunteer(ctx);

		if (args.parentType === "task") {
			const task = await ctx.db.get("tasks", args.parentId as Id<"tasks">);
			if (!task) throw new ConvexError("Task not found");

			if (!volunteer) {
				if (!task.parentCompetitionId) {
					throw new ConvexError({
						code: "FORBIDDEN",
						message: ERROR_COMMENT_NO_ACCESS_TASK,
					});
				}
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					task.parentCompetitionId,
				);
				if (!hasAccess) {
					throw new ConvexError({
						code: "FORBIDDEN",
						message: ERROR_COMMENT_NO_ACCESS_TASK,
					});
				}
			}
		} else if (args.parentType === "update") {
			const update = await ctx.db.get(
				"competitionUpdates",
				args.parentId as Id<"competitionUpdates">,
			);
			if (!update) throw new ConvexError("Update not found");

			if (!volunteer) {
				const hasAccess = await hasCompetitionAccess(
					ctx,
					volunteer,
					userId,
					update.competitionId,
				);
				if (!hasAccess) {
					throw new ConvexError({
						code: "FORBIDDEN",
						message: ERROR_COMMENT_NO_ACCESS_UPDATE,
					});
				}
			}
		}

		const now = Date.now();
		const commentId = await ctx.db.insert("comments", {
			parentType: args.parentType,
			parentId: args.parentId,
			parentCommentId: args.parentCommentId,
			authorId: userId,
			content: args.content,
			reactions: [],
			updatedAt: now,
		});

		if (args.parentType !== "task") return commentId;

		const taskId = args.parentId as Id<"tasks">;
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return commentId;

		const mentionedUserIds = await extractMentions(ctx, args.content);
		const notifiedUserIds = new Set<Id<"users">>();
		const notificationPromises: Promise<unknown>[] = [];

		for (const mentionedUserId of mentionedUserIds) {
			if (mentionedUserId !== userId) {
				notificationPromises.push(
					ctx.scheduler.runAfter(
						0,
						internal.notifications._notifyTaskMentioned,
						{
							taskId,
							commentId,
							mentionedUserId,
							actorId: userId,
						},
					),
				);
				notifiedUserIds.add(mentionedUserId);
			}
		}

		if (
			task.assigneeId &&
			task.assigneeId !== userId &&
			!notifiedUserIds.has(task.assigneeId)
		) {
			notificationPromises.push(
				ctx.scheduler.runAfter(0, internal.notifications._notifyCommentAdded, {
					taskId,
					commentId,
					recipientId: task.assigneeId,
					actorId: userId,
				}),
			);
		}

		if (
			task.ownerId &&
			task.ownerType === "user" &&
			task.ownerId !== userId &&
			task.ownerId !== task.assigneeId &&
			!notifiedUserIds.has(task.ownerId as Id<"users">)
		) {
			notificationPromises.push(
				ctx.scheduler.runAfter(0, internal.notifications._notifyCommentAdded, {
					taskId,
					commentId,
					recipientId: task.ownerId as Id<"users">,
					actorId: userId,
				}),
			);
		}

		await Promise.allSettled(notificationPromises);
		return commentId;
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
			contentUpdatedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const remove = mutation({
	args: { commentId: v.id("comments") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc) return null;

		// Allow deletion if user is the comment author or a director
		const isCommentAuthor = doc.authorId === userId;
		const isDirector = await isDirectorForCtx(ctx);

		if (!isCommentAuthor && !isDirector) {
			return null;
		}

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
			contentUpdatedAt:
				d.contentUpdatedAt != null ? toISO(d.contentUpdatedAt) : undefined,
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
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc) return null;

		const reactions = [...doc.reactions];
		const idx = reactions.findIndex((r) => r.emoji === args.emoji);
		if (idx >= 0) {
			const userIds = [...reactions[idx].userIds];
			const userIdx = userIds.indexOf(userId);
			if (userIdx >= 0) {
				userIds.splice(userIdx, 1);
				if (userIds.length === 0) reactions.splice(idx, 1);
				else reactions[idx] = { ...reactions[idx], userIds };
			} else {
				userIds.push(userId);
				reactions[idx] = { ...reactions[idx], userIds };
			}
		} else {
			reactions.push({ emoji: args.emoji, userIds: [userId] });
		}

		await ctx.db.patch("comments", args.commentId, {
			reactions,
			updatedAt: Date.now(),
		});
		return null;
	},
});
