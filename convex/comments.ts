import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId, isVolunteer } from "./auth";
import { logActivity } from "./lib/activity";
import { internal } from "./_generated/api";
import { isDirectorForCtx } from "./admin";
import { hasCompetitionAccess } from "./competitionAccess";
import { toUsers, createLens, type UserUI } from "./lib/transforms";
import { validateRequiredText } from "./lib/sanitize";
import { getCommentParentId } from "./lib/commentParentId";
import { parentType } from "./lib/validators";

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

const userShape = v.object({
	id: v.string(),
	name: v.string(),
	avatarUrl: v.string(),
});

const reactionShape = v.object({
	emoji: v.string(),
	users: v.array(userShape),
});

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

		const getCompetitionId = {
			task: async () =>
				(await ctx.db.get(getCommentParentId("task", args.parentId)))
					?.parentCompetitionId,
			update: async () =>
				(await ctx.db.get(getCommentParentId("update", args.parentId)))
					?.competitionId,
		}[args.parentType];

		const competitionId = await getCompetitionId();
		if (!competitionId && !volunteer) return [];
		if (
			competitionId &&
			!volunteer &&
			!(await hasCompetitionAccess(ctx, volunteer, userId, competitionId))
		)
			return [];

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
		const userDocs = await Promise.all(
			[...allUserIds].map((id) => ctx.db.get("users", id)),
		);
		const usersLens = createLens(toUsers(userDocs));

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
		const userId = await requireUserId(ctx);
		const volunteer = await isVolunteer(ctx);

		const entityFetchers = {
			task: async () => {
				const task = await ctx.db.get(
					"tasks",
					getCommentParentId("task", args.parentId),
				);
				return {
					entity: task,
					competitionId: task?.parentCompetitionId,
					errorMsg: ERROR_COMMENT_NO_ACCESS_TASK,
				};
			},
			update: async () => {
				const update = await ctx.db.get(
					"competitionUpdates",
					getCommentParentId("update", args.parentId),
				);
				return {
					entity: update,
					competitionId: update?.competitionId,
					errorMsg: ERROR_COMMENT_NO_ACCESS_UPDATE,
				};
			},
		};

		const { entity, competitionId, errorMsg } =
			await entityFetchers[args.parentType]();
		if (!entity)
			throw new ConvexError(
				`${args.parentType === "task" ? "Task" : "Update"} not found`,
			);

		if (!volunteer) {
			if (
				!competitionId ||
				!(await hasCompetitionAccess(ctx, volunteer, userId, competitionId))
			) {
				throw new ConvexError({ code: "FORBIDDEN", message: errorMsg });
			}
		}

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

		await logActivity(
			ctx,
			userId,
			args.parentType,
			args.parentId,
			"comment_added",
		);

		if (args.parentType !== "task") return commentId;

		const taskId = getCommentParentId("task", args.parentId);
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return commentId;

		const mentionedUserIds = await extractMentions(ctx, args.content);
		const notifiedUserIds = new Set<Id<"users">>();

		for (const mentionedUserId of mentionedUserIds) {
			if (mentionedUserId !== userId) {
				void ctx.scheduler.runAfter(
					0,
					internal.notifications._notifyTaskMentioned,
					{
						taskId,
						commentId,
						mentionedUserId,
						actorId: userId,
					},
				);
				notifiedUserIds.add(mentionedUserId);
			}
		}

		if (
			task.assigneeId &&
			task.assigneeId !== userId &&
			!notifiedUserIds.has(task.assigneeId)
		) {
			void ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyCommentAdded,
				{
					taskId,
					commentId,
					recipientId: task.assigneeId,
					actorId: userId,
				},
			);
		}

		if (
			task.ownerId &&
			task.ownerType === "user" &&
			task.ownerId !== userId &&
			task.ownerId !== task.assigneeId &&
			!notifiedUserIds.has(task.ownerId as Id<"users">)
		) {
			void ctx.scheduler.runAfter(
				0,
				internal.notifications._notifyCommentAdded,
				{
					taskId,
					commentId,
					recipientId: task.ownerId as Id<"users">,
					actorId: userId,
				},
			);
		}
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
		await logActivity(
			ctx,
			userId,
			doc.parentType,
			doc.parentId,
			"comment_edited",
		);
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
			return null;
		}

		await logActivity(
			ctx,
			userId,
			doc.parentType,
			doc.parentId,
			"comment_deleted",
		);
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

		const authorIds = new Set<Id<"users">>();
		const reactionUserIds = new Set<Id<"users">>();
		for (const d of docs) {
			authorIds.add(d.authorId);
			for (const r of d.reactions) {
				for (const uid of r.userIds) reactionUserIds.add(uid);
			}
		}
		const allUserIds = new Set([...authorIds, ...reactionUserIds]);
		const userDocs = await Promise.all(
			[...allUserIds].map((id) => ctx.db.get("users", id)),
		);
		const usersLens = createLens(toUsers(userDocs));

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
