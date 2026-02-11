import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";


export async function collectAllTaskIdsRecursively(
	ctx: QueryCtx,
	parentTaskIds: Id<"tasks">[],
	allTaskIds: Set<Id<"tasks">>,
): Promise<void> {
	const subtaskPromises = parentTaskIds.map(async (parentTaskId) => {
		if (allTaskIds.has(parentTaskId)) return [];
		allTaskIds.add(parentTaskId);
		const subtasks = await ctx.db
			.query("tasks")
			.withIndex("by_parent_task", (q) => q.eq("parentTaskId", parentTaskId))
			.collect();
		return subtasks.map((t) => t._id);
	});

	const allSubtasks = (await Promise.all(subtaskPromises)).flat();
	if (allSubtasks.length > 0) {
		await collectAllTaskIdsRecursively(ctx, allSubtasks, allTaskIds);
	}
}

async function collectAllCommentIdsRecursively(
	ctx: MutationCtx,
	commentIds: Id<"comments">[],
	allCommentIds: Set<Id<"comments">>,
): Promise<void> {
	const nestedPromises = commentIds.map(async (commentId) => {
		if (allCommentIds.has(commentId)) return [];
		allCommentIds.add(commentId);
		const nested = await ctx.db
			.query("comments")
			.withIndex("by_parent_comment", (q) => q.eq("parentCommentId", commentId))
			.collect();
		return nested.map((n) => n._id);
	});

	const allNested = (await Promise.all(nestedPromises)).flat();
	if (allNested.length > 0) {
		await collectAllCommentIdsRecursively(ctx, allNested, allCommentIds);
	}
}

type SubscribedEntityType = "task" | "competition" | "comment";
type NotificationEntityType = "task" | "competition" | "comment" | "reminder";

function dedupeById<T extends { _id: string }>(rows: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const row of rows) {
		if (seen.has(row._id)) continue;
		seen.add(row._id);
		unique.push(row);
	}
	return unique;
}

async function deleteNotificationArtifactsForNotifications(
	ctx: MutationCtx,
	notifications: Doc<"notifications">[],
	extraEventRefs: Array<{
		entityType: NotificationEntityType;
		entityId: string;
	}> = [],
): Promise<void> {
	const notificationIds = new Set<Id<"notifications">>();
	const eventIds = new Set<Id<"notificationEvents">>();
	for (const notification of notifications) {
		notificationIds.add(notification._id);
		if (notification.sourceEventId) {
			eventIds.add(notification.sourceEventId);
		}
	}

	if (extraEventRefs.length > 0) {
		const eventRows = (
			await Promise.all(
				extraEventRefs.map((ref) =>
					ctx.db
						.query("notificationEvents")
						.withIndex("by_entity", (q) =>
							q.eq("entityType", ref.entityType).eq("entityId", ref.entityId),
						)
						.collect(),
				),
			)
		).flat();
		for (const event of eventRows) {
			eventIds.add(event._id);
		}
	}

	const dispatchRowsByNotification = (
		await Promise.all(
			Array.from(notificationIds).map((notificationId) =>
				ctx.db
					.query("notificationDispatches")
					.withIndex("by_notification", (q) =>
						q.eq("notificationId", notificationId),
					)
					.collect(),
			),
		)
	).flat();
	const dispatchRowsByEvent = (
		await Promise.all(
			Array.from(eventIds).map((eventId) =>
				ctx.db
					.query("notificationDispatches")
					.withIndex("by_event", (q) => q.eq("eventId", eventId))
					.collect(),
			),
		)
	).flat();
	const dispatchRows = dedupeById([
		...dispatchRowsByNotification,
		...dispatchRowsByEvent,
	]);

	const scheduledIds = new Set<Id<"_scheduled_functions">>();
	for (const dispatch of dispatchRows) {
		if (dispatch.scheduledFunctionId) {
			scheduledIds.add(dispatch.scheduledFunctionId);
		}
	}
	await Promise.all(
		Array.from(scheduledIds).map((scheduledId) =>
			ctx.scheduler.cancel(scheduledId),
		),
	);

	await Promise.all([
		...dispatchRows.map((dispatch) =>
			ctx.db.delete("notificationDispatches", dispatch._id),
		),
		...Array.from(notificationIds).map((notificationId) =>
			ctx.db.delete("notifications", notificationId),
		),
		...Array.from(eventIds).map((eventId) =>
			ctx.db.delete("notificationEvents", eventId),
		),
	]);
}

export async function deleteEntitySubscriptions(
	ctx: MutationCtx,
	entityType: SubscribedEntityType,
	entityIds: string[],
): Promise<void> {
	if (entityIds.length === 0) {
		return;
	}

	const subscriptionRows = (
		await Promise.all(
			entityIds.map((entityId) =>
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", entityType).eq("entityId", entityId),
					)
					.collect(),
			),
		)
	).flat();

	if (subscriptionRows.length === 0) {
		return;
	}

	const subscriptionIdsToDelete = new Set(
		subscriptionRows.map((subscription) => subscription._id),
	);
	await Promise.all(
		Array.from(subscriptionIdsToDelete).map((subscriptionId) =>
			ctx.db.delete("notificationSubscriptions", subscriptionId),
		),
	);
}

export async function deleteCommentsAndReplies(
	ctx: MutationCtx,
	parentType: "task" | "update",
	parentId: string,
): Promise<Id<"comments">[]> {
	const comments = await ctx.db
		.query("comments")
		.withIndex("by_parent", (q) =>
			q.eq("parentType", parentType).eq("parentId", parentId),
		)
		.collect();

	const allCommentIds = new Set<Id<"comments">>();
	await collectAllCommentIdsRecursively(
		ctx,
		comments.map((c) => c._id),
		allCommentIds,
	);

	await deleteEntitySubscriptions(
		ctx,
		"comment",
		Array.from(allCommentIds).map((commentId) => `${commentId}`),
	);

	await Promise.all(
		Array.from(allCommentIds).map((id) => ctx.db.delete("comments", id)),
	);
	return Array.from(allCommentIds);
}


export async function deleteTasksAndRelatedData(
	ctx: MutationCtx,
	taskIdArray: Id<"tasks">[],
): Promise<void> {
	if (taskIdArray.length === 0) return;

	const remindersToDelete = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("reminders")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "task").eq("entityId", taskId),
					)
					.collect(),
			),
		)
	).flat();

	const notificationsByEntity = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "task").eq("entityId", taskId),
					)
					.collect(),
			),
		)
	).flat();
	const notificationsByParent = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_parent_entity", (q) => q.eq("parentEntityId", taskId))
					.collect(),
			),
		)
	).flat();
	const notificationsToDelete = dedupeById([
		...notificationsByEntity,
		...notificationsByParent,
	]);

	const relationsByBlockedTask = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("taskRelations")
					.withIndex("by_blocked_and_blocking", (q) =>
						q.eq("blockedTaskId", taskId),
					)
					.collect(),
			),
		)
	).flat();

	const relationsByBlockingTask = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("taskRelations")
					.withIndex("by_blocking_task", (q) => q.eq("blockingTaskId", taskId))
					.collect(),
			),
		)
	).flat();
	const relationIdsToDelete = new Set<Id<"taskRelations">>();
	for (const relation of relationsByBlockedTask) {
		relationIdsToDelete.add(relation._id);
	}
	for (const relation of relationsByBlockingTask) {
		relationIdsToDelete.add(relation._id);
	}

	const taskActivityLogPromises = taskIdArray.map((taskId) =>
		ctx.db
			.query("activityLog")
			.withIndex("by_entity", (q) =>
				q.eq("entityType", "task").eq("entityId", taskId),
			)
			.collect(),
	);
	const taskActivityLogs = (await Promise.all(taskActivityLogPromises)).flat();

	for (const reminder of remindersToDelete) {
		if (reminder.scheduledFunctionId) {
			await ctx.scheduler.cancel(reminder.scheduledFunctionId);
		}
	}

	await Promise.all([
		...remindersToDelete.map((r) => ctx.db.delete("reminders", r._id)),
		...Array.from(relationIdsToDelete).map((relationId) =>
			ctx.db.delete("taskRelations", relationId),
		),
		...taskActivityLogs.map((l) => ctx.db.delete("activityLog", l._id)),
	]);

	const deletedCommentIds = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				deleteCommentsAndReplies(ctx, "task", taskId),
			),
		)
	).flat();
	await deleteEntitySubscriptions(
		ctx,
		"task",
		taskIdArray.map((taskId) => `${taskId}`),
	);
	await deleteNotificationArtifactsForNotifications(
		ctx,
		notificationsToDelete,
		[
			...taskIdArray.map((taskId) => ({
				entityType: "task" as const,
				entityId: `${taskId}`,
			})),
			...deletedCommentIds.map((commentId) => ({
				entityType: "comment" as const,
				entityId: `${commentId}`,
			})),
			...remindersToDelete.map((reminder) => ({
				entityType: "reminder" as const,
				entityId: `${reminder._id}`,
			})),
		],
	);

	for (const taskId of taskIdArray) {
		await ctx.db.delete("tasks", taskId);
	}
}

export async function deleteNotificationArtifactsForEntity(
	ctx: MutationCtx,
	entity: {
		entityType: NotificationEntityType;
		entityId: string;
	},
): Promise<void> {
	const notifications = await ctx.db
		.query("notifications")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", entity.entityType).eq("entityId", entity.entityId),
		)
		.collect();
	await deleteNotificationArtifactsForNotifications(ctx, notifications, [
		entity,
	]);
}
