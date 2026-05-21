import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUserId } from "../core/auth";
import { getCommentParentId } from "../lib/commentParentId";
import { toISO } from "../lib/transforms";
import {
	canUserAccessComment,
	canUserAccessCompetition,
	canUserAccessNotificationEntity,
	canUserAccessTask,
} from "./lib/notificationAccess";
import {
	DEFAULT_SUBSCRIPTION_LIST_LIMIT,
	MAX_SUBSCRIPTION_LIST_LIMIT,
	entitySubscriptionArgs,
	type EntitySubscriptionArg,
	type NotificationEntityRef,
	notificationSubscriptionReturns,
} from "./lib/notificationTypes";

type SubscriptionPresentation = {
	label: string;
	description?: string;
	isStale: boolean;
};

function normalizeSubscriptionListLimit(limit: number | undefined): number {
	return Math.max(
		1,
		Math.min(
			limit ?? DEFAULT_SUBSCRIPTION_LIST_LIMIT,
			MAX_SUBSCRIPTION_LIST_LIMIT,
		),
	);
}

const stale = (
	label: string,
	description: string,
): SubscriptionPresentation => ({
	label,
	description,
	isStale: true,
});

function entityRefFromSubscriptionArg(
	entity: EntitySubscriptionArg,
): NotificationEntityRef {
	return entity.entityType === "comment"
		? { entityType: "comment", entityId: entity.entityId }
		: entity;
}

async function ensureSubscriptionEntityAccess(
	ctx: MutationCtx,
	userId: Id<"users">,
	entity: EntitySubscriptionArg,
): Promise<void> {
	if (
		!(await canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(entity),
		))
	) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You do not have access to watch this entity.",
		});
	}
}

async function findUserEntitySubscription(
	ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
	userId: Id<"users">,
	entityType: "task" | "competition" | "comment",
	entityId: string,
) {
	return ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_user_entity", (q) =>
			q
				.eq("userId", userId)
				.eq("entityType", entityType)
				.eq("entityId", entityId),
		)
		.unique();
}

async function describeEntitySubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityType: string,
	entityId: string,
): Promise<SubscriptionPresentation> {
	if (entityType === "task") {
		const taskId = ctx.db.normalizeId("tasks", entityId);
		if (!taskId) return stale("Deleted task", "Task");
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return stale("Deleted task", "Task");
		if (!(await canUserAccessTask(ctx, userId, taskId))) {
			return stale("Restricted task", "Task");
		}
		return {
			label: `${task.identifier}: ${task.title}`,
			description: "Task",
			isStale: false,
		};
	}

	if (entityType === "competition") {
		const competitionId = ctx.db.normalizeId("competitions", entityId);
		if (!competitionId) return stale("Deleted competition", "Competition");
		const competition = await ctx.db.get("competitions", competitionId);
		if (!competition) return stale("Deleted competition", "Competition");
		if (!(await canUserAccessCompetition(ctx, userId, competitionId))) {
			return stale("Restricted competition", "Competition");
		}
		return {
			label: competition.name,
			description: "Competition",
			isStale: false,
		};
	}

	const commentId = ctx.db.normalizeId("comments", entityId);
	if (!commentId) return stale("Deleted comment", "Comment");
	const comment = await ctx.db.get("comments", commentId);
	if (!comment) return stale("Deleted comment", "Comment");
	if (!(await canUserAccessComment(ctx, userId, commentId))) {
		return stale("Restricted comment", "Comment");
	}

	if (comment.parentType === "task") {
		const task = await ctx.db.get(
			"tasks",
			getCommentParentId("task", comment.parentId),
		);
		return task
			? {
					label: `Comment on ${task.identifier}`,
					description: "Task comment",
					isStale: false,
				}
			: stale("Comment on deleted task", "Task comment");
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", comment.parentId),
	);
	if (!update) {
		return stale("Comment on deleted update", "Competition update comment");
	}
	const competition = await ctx.db.get("competitions", update.competitionId);
	return {
		label: competition
			? `Comment on ${competition.name}`
			: "Comment on competition update",
		description: "Competition update comment",
		isStale: competition === null,
	};
}

export const listSubscriptions = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(notificationSubscriptionReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeSubscriptionListLimit(args.limit);
		const docs = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_updated_at", (q) => q.eq("userId", userId))
			.order("desc")
			.take(limit);

		return Promise.all(
			docs.map(async (doc) => {
				const presentation = await describeEntitySubscription(
					ctx,
					userId,
					doc.entityType,
					doc.entityId,
				);
				return {
					id: doc._id,
					entityType: doc.entityType,
					entityId: doc.entityId,
					label: presentation.label,
					description: presentation.description,
					isStale: presentation.isStale,
					updatedAt: toISO(doc.updatedAt),
				};
			}),
		);
	},
});

export const isSubscribedToEntity = query({
	args: { entity: entitySubscriptionArgs },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (!existing) {
			return false;
		}
		return canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(args.entity),
		);
	},
});

export const subscribeToEntity = mutation({
	args: { entity: entitySubscriptionArgs },
	returns: v.id("notificationSubscriptions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await ensureSubscriptionEntityAccess(ctx, userId, args.entity);

		const entityId = `${args.entity.entityId}`;
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			entityId,
		);
		if (existing) {
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			entityType: args.entity.entityType,
			entityId,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromEntity = mutation({
	args: { entity: entitySubscriptionArgs },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (existing) {
			await ctx.db.delete("notificationSubscriptions", existing._id);
		}
		return null;
	},
});

export const unsubscribe = mutation({
	args: { subscriptionId: v.id("notificationSubscriptions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db.get(
			"notificationSubscriptions",
			args.subscriptionId,
		);
		if (!existing || existing.userId !== userId) {
			return null;
		}
		await ctx.db.delete("notificationSubscriptions", args.subscriptionId);
		return null;
	},
});
