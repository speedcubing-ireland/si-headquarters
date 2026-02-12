import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId, isVolunteer } from "./auth";
import { isDirectorForCtx } from "./admin";
import { hasCompetitionAccess } from "./competitionAccess";
import { toUsers, createLens, type UserUI } from "./lib/transforms";
import { validateRequiredText } from "./lib/sanitize";
import { getCommentParentId } from "./lib/commentParentId";
import { parentType, userShape } from "./lib/validators";
import {
	sendMentionNotifications,
	sendReplyNotifications,
	sendCommentAddedNotifications,
} from "./notifications/triggers/comments";

function mapCommentForUI(
	doc: {
		_id: Id<"comments">;
		parentType: "task" | "update";
		parentId: string;
		parentCommentId?: Id<"comments">;
		authorId: Id<"users">;
		content: string;
		_creationTime: number;
		updatedAt: number;
		contentUpdatedAt?: number;
		reactions: Array<{ emoji: string; userIds: Id<"users">[] }>;
	},
	usersLens: ReturnType<typeof createLens<UserUI>>,
) {
	return {
		id: doc._id,
		parentType: doc.parentType,
		parentId: doc.parentId,
		parentCommentId: doc.parentCommentId ?? null,
		author: usersLens.get(doc.authorId) ?? {
			id: doc.authorId,
			name: "",
			avatarUrl: "",
		},
		content: doc.content,
		createdAt: new Date(doc._creationTime).toISOString(),
		updatedAt: new Date(doc.updatedAt).toISOString(),
		contentUpdatedAt:
			doc.contentUpdatedAt != null
				? new Date(doc.contentUpdatedAt).toISOString()
				: undefined,
		reactions: doc.reactions.map((r) => ({
			emoji: r.emoji,
			users: r.userIds
				.map((uid) => usersLens.get(uid))
				.filter((u): u is UserUI => Boolean(u)),
		})),
	};
}

const ERROR_COMMENT_NO_ACCESS_TASK =
	"You can only comment on tasks linked to competitions you are organizing";
const ERROR_COMMENT_NO_ACCESS_UPDATE =
	"You can only comment on updates for competitions you are organizing";

const reactionShape = v.object({
	emoji: v.string(),
	users: v.array(userShape),
});

type CommentDoc = {
	_id: Id<"comments">;
	parentType: "task" | "update";
	parentId: string;
	parentCommentId?: Id<"comments">;
	authorId: Id<"users">;
	content: string;
	_creationTime: number;
	updatedAt: number;
	contentUpdatedAt?: number;
	reactions: Array<{ emoji: string; userIds: Id<"users">[] }>;
};

type CommentParentEntityType = "task" | "update";
type CommentParentLookup = {
	exists: boolean;
	competitionId: Id<"competitions"> | undefined;
};

type CommentDbCtx = MutationCtx | QueryCtx;

function commentParentNotFoundMessage(parent: CommentParentEntityType): string {
	return parent === "task" ? "Task not found" : "Update not found";
}

function commentParentNoAccessMessage(parent: CommentParentEntityType): string {
	return parent === "task"
		? ERROR_COMMENT_NO_ACCESS_TASK
		: ERROR_COMMENT_NO_ACCESS_UPDATE;
}

async function lookupCommentParent(
	ctx: CommentDbCtx,
	parent: CommentParentEntityType,
	parentId: string,
): Promise<CommentParentLookup> {
	if (parent === "task") {
		const task = await ctx.db.get(
			"tasks",
			getCommentParentId("task", parentId),
		);
		return {
			exists: task !== null,
			competitionId: task?.parentCompetitionId,
		};
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", parentId),
	);
	return {
		exists: update !== null,
		competitionId: update?.competitionId,
	};
}

async function ensureCommentParentAccess(
	ctx: CommentDbCtx,
	args: {
		parentType: CommentParentEntityType;
		parentId: string;
		userId: Id<"users">;
		volunteer: boolean;
	},
): Promise<void> {
	const parentLookup = await lookupCommentParent(
		ctx,
		args.parentType,
		args.parentId,
	);
	if (!parentLookup.exists) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: commentParentNotFoundMessage(args.parentType),
		});
	}
	if (args.volunteer) {
		return;
	}

	const hasAccess =
		parentLookup.competitionId !== undefined &&
		(await hasCompetitionAccess(
			ctx,
			args.volunteer,
			args.userId,
			parentLookup.competitionId,
		));
	if (!hasAccess) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: commentParentNoAccessMessage(args.parentType),
		});
	}
}

async function canReadCommentParent(
	ctx: CommentDbCtx,
	args: {
		parentType: CommentParentEntityType;
		parentId: string;
		userId: Id<"users">;
		volunteer: boolean;
	},
): Promise<boolean> {
	if (args.volunteer) {
		return true;
	}
	const parentLookup = await lookupCommentParent(
		ctx,
		args.parentType,
		args.parentId,
	);
	if (!parentLookup.competitionId) {
		return false;
	}
	return hasCompetitionAccess(
		ctx,
		args.volunteer,
		args.userId,
		parentLookup.competitionId,
	);
}

function collectCommentUserIds(docs: CommentDoc[]): Set<Id<"users">> {
	const allUserIds = new Set<Id<"users">>();
	for (const doc of docs) {
		allUserIds.add(doc.authorId);
		for (const reaction of doc.reactions) {
			for (const userId of reaction.userIds) {
				allUserIds.add(userId);
			}
		}
	}
	return allUserIds;
}

async function buildCommentUsersLens(ctx: CommentDbCtx, docs: CommentDoc[]) {
	const userIds = [...collectCommentUserIds(docs)];
	const userDocs = await Promise.all(
		userIds.map((id) => ctx.db.get("users", id)),
	);
	return createLens(toUsers(userDocs));
}

async function resolveParentComment(
	ctx: Pick<MutationCtx, "db">,
	args: {
		parentCommentId?: Id<"comments">;
		parentType: "task" | "update";
		parentId: string;
	},
): Promise<Doc<"comments"> | null> {
	if (!args.parentCommentId) {
		return null;
	}
	const parentComment = await ctx.db.get("comments", args.parentCommentId);
	if (!parentComment) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Parent comment not found",
		});
	}
	if (
		parentComment.parentType !== args.parentType ||
		parentComment.parentId !== args.parentId
	) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Parent comment must belong to the same parent",
		});
	}
	return parentComment;
}

type CommentReaction = { emoji: string; userIds: Id<"users">[] };

function toggleUserReaction(
	reactions: CommentReaction[],
	emoji: string,
	userId: Id<"users">,
): CommentReaction[] {
	const next = [...reactions];
	const reactionIndex = next.findIndex((reaction) => reaction.emoji === emoji);
	if (reactionIndex < 0) {
		next.push({ emoji, userIds: [userId] });
		return next;
	}

	const userIds = [...next[reactionIndex].userIds];
	const userIndex = userIds.indexOf(userId);
	if (userIndex >= 0) {
		userIds.splice(userIndex, 1);
		if (userIds.length === 0) {
			next.splice(reactionIndex, 1);
		} else {
			next[reactionIndex] = { ...next[reactionIndex], userIds };
		}
		return next;
	}

	userIds.push(userId);
	next[reactionIndex] = { ...next[reactionIndex], userIds };
	return next;
}

async function deleteCommentEntitySubscriptions(
	ctx: MutationCtx,
	commentId: Id<"comments">,
): Promise<void> {
	const subscriptions = await ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", "comment").eq("entityId", `${commentId}`),
		)
		.collect();
	await Promise.all(
		subscriptions.map((subscription) =>
			ctx.db.delete("notificationSubscriptions", subscription._id),
		),
	);
}

export const commentForUIReturns = v.object({
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
		parentId: v.union(v.id("tasks"), v.id("competitionUpdates")),
	},
	returns: v.array(commentForUIReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		const hasReadAccess = await canReadCommentParent(ctx, {
			parentType: args.parentType,
			parentId: args.parentId,
			userId,
			volunteer,
		});
		if (!hasReadAccess) {
			return [];
		}

		const docs = await ctx.db
			.query("comments")
			.withIndex("by_parent", (q) =>
				q.eq("parentType", args.parentType).eq("parentId", args.parentId),
			)
			.order("asc")
			.collect();
		const usersLens = await buildCommentUsersLens(ctx, docs);

		return docs.map((d) => mapCommentForUI(d, usersLens));
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
	ctx: Pick<MutationCtx, "db">,
	content: string,
): Promise<Id<"users">[]> {
	const mentionRegex = /@(\w+)/g;
	const matches = Array.from(content.matchAll(mentionRegex));
	if (matches.length === 0) return [];

	const mentionedNames = new Set(matches.map((m) => m[1].toLowerCase()));
	const allUsers = await ctx.db.query("users").withIndex("email").collect();
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
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);
		await ensureCommentParentAccess(ctx, {
			parentType: args.parentType,
			parentId: args.parentId,
			userId,
			volunteer,
		});
		const parentComment = await resolveParentComment(ctx, {
			parentCommentId: args.parentCommentId,
			parentType: args.parentType,
			parentId: args.parentId,
		});

		const sanitizedContent = validateRequiredText(args.content, "Comment");

		const now = Date.now();
		const commentId = await ctx.db.insert("comments", {
			parentType: args.parentType,
			parentId: args.parentId,
			parentCommentId: args.parentCommentId,
			authorId: userId,
			content: sanitizedContent,
			reactions: [],
			updatedAt: now,
		});

		if (args.parentType !== "task") return commentId;

		const taskId = getCommentParentId("task", args.parentId);
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return commentId;

		const mentionedUserIds = await extractMentions(ctx, args.content);
		const mentionNotified = await sendMentionNotifications(ctx, {
			taskId,
			commentId,
			mentionedUserIds,
			actorId: userId,
		});
		const replyNotified = await sendReplyNotifications(ctx, {
			taskId,
			commentId,
			parentComment,
			actorId: userId,
			excludedRecipients: mentionNotified,
		});
		const allExcluded = new Set([...mentionNotified, ...replyNotified]);
		await sendCommentAddedNotifications(ctx, {
			taskId,
			commentId,
			task,
			actorId: userId,
			excludedRecipients: allExcluded,
		});
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

		const sanitizedContent = validateRequiredText(args.content, "Comment");

		await ctx.db.patch("comments", args.commentId, {
			content: sanitizedContent,
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
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc) return null;
		const isCommentAuthor = doc.authorId === userId;
		const isDirector = await isDirectorForCtx(ctx);

		if (!isCommentAuthor && !isDirector) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You can only delete your own comments",
			});
		}

		await deleteCommentEntitySubscriptions(ctx, args.commentId);

		await ctx.db.delete("comments", args.commentId);
		return null;
	},
});

export const listRecentForSearch = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(commentForUIReturns),
	handler: async (ctx, args) => {
		const volunteer = await isVolunteer(ctx);
		if (!volunteer) return [];

		const limit = args.limit ?? 100;
		const docs = await ctx.db.query("comments").order("desc").take(limit);
		const usersLens = await buildCommentUsersLens(ctx, docs);

		return docs.map((d) => mapCommentForUI(d, usersLens));
	},
});

export const toggleReaction = mutation({
	args: {
		commentId: v.id("comments"),
		emoji: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("comments", args.commentId);
		if (!doc) return null;
		const volunteer = await isVolunteer(ctx);
		const canReadParent = await canReadCommentParent(ctx, {
			parentType: doc.parentType,
			parentId: doc.parentId,
			userId,
			volunteer,
		});
		if (!canReadParent) return null;
		const reactions = toggleUserReaction(doc.reactions, args.emoji, userId);

		await ctx.db.patch("comments", args.commentId, {
			reactions,
			updatedAt: Date.now(),
		});
		return null;
	},
});
