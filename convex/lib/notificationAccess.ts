import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isVolunteer } from "../auth";
import { hasCompetitionAccess } from "../competitionAccess";
import { hasTaskCompetitionAccess } from "../taskAccess";
import { getCommentParentId } from "./commentParentId";
import type {
	NotificationEntityRef,
	NotificationSubscriberEntityType,
} from "./notificationTypes";

export async function canUserAccessTask(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	taskId: Id<"tasks">,
): Promise<boolean> {
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		return false;
	}

	const volunteer = await isVolunteer(ctx);
	if (volunteer) {
		return true;
	}

	if (!task.parentCompetitionId) {
		return false;
	}

	return hasTaskCompetitionAccess(
		ctx,
		volunteer,
		userId,
		task.parentCompetitionId,
	);
}

export async function canUserAccessCompetition(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	competitionId: Id<"competitions">,
): Promise<boolean> {
	const volunteer = await isVolunteer(ctx);
	return hasCompetitionAccess(ctx, volunteer, userId, competitionId);
}

export async function canUserAccessComment(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	commentId: Id<"comments">,
	parentTaskId?: Id<"tasks">,
): Promise<boolean> {
	if (parentTaskId) {
		return canUserAccessTask(ctx, userId, parentTaskId);
	}

	const comment = await ctx.db.get("comments", commentId);
	if (!comment) {
		return false;
	}

	if (comment.parentType === "task") {
		return canUserAccessTask(
			ctx,
			userId,
			getCommentParentId("task", comment.parentId),
		);
	}

	const updateId = getCommentParentId("update", comment.parentId);
	const update = await ctx.db.get("competitionUpdates", updateId);
	if (!update) {
		return false;
	}
	return canUserAccessCompetition(ctx, userId, update.competitionId);
}

export async function canUserAccessReminder(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	reminderId: Id<"reminders">,
): Promise<boolean> {
	const reminder = await ctx.db.get("reminders", reminderId);
	if (!reminder) {
		return false;
	}
	return reminder.userId === userId;
}

export async function canUserAccessNotificationEntity(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	entity: NotificationEntityRef,
): Promise<boolean> {
	switch (entity.entityType) {
		case "task":
			return canUserAccessTask(ctx, userId, entity.entityId);
		case "competition":
			return canUserAccessCompetition(ctx, userId, entity.entityId);
		case "comment":
			return canUserAccessComment(
				ctx,
				userId,
				entity.entityId,
				entity.parentTaskId,
			);
		case "reminder":
			return canUserAccessReminder(ctx, userId, entity.entityId);
	}
}

export function subscriberTargetForEntity(entity: NotificationEntityRef): {
	entityType: NotificationSubscriberEntityType;
	entityId: string;
} | null {
	switch (entity.entityType) {
		case "task":
			return {
				entityType: "task",
				entityId: entity.entityId,
			};
		case "competition":
			return {
				entityType: "competition",
				entityId: entity.entityId,
			};
		case "comment":
			if (entity.parentTaskId) {
				return {
					entityType: "task",
					entityId: entity.parentTaskId,
				};
			}
			return {
				entityType: "comment",
				entityId: entity.entityId,
			};
		case "reminder":
			return null;
	}
}

export async function getEntitySubscriberIds(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Id<"users">[]> {
	const target = subscriberTargetForEntity(entity);
	if (!target) {
		return [];
	}

	const subscriptions = await ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", target.entityType).eq("entityId", target.entityId),
		)
		.collect();

	const userIds = new Set<Id<"users">>();
	for (const subscription of subscriptions) {
		if (subscription.subscriptionType !== "entity") {
			continue;
		}
		if (
			subscription.entityType !== target.entityType ||
			subscription.entityId !== target.entityId
		) {
			continue;
		}
		userIds.add(subscription.userId);
	}
	return [...userIds];
}
