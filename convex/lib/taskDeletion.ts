import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Recursively collects all task IDs starting from a set of parent task IDs,
 * traversing parent-child relationships via `parentTaskId`.
 */
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
): Promise<void> {
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
}

/**
 * Deletes tasks and all related data: reminders, notifications, relations,
 * activity logs, comments, and subscriptions.
 */
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

	const notificationsToDelete = (
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

	const relationsByBlockedTask = (
		await Promise.all(
			taskIdArray.map((taskId) =>
				ctx.db
					.query("taskRelations")
					.withIndex("by_blocked_task", (q) => q.eq("blockedTaskId", taskId))
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

	await Promise.all([
		...remindersToDelete.map((r) => ctx.db.delete("reminders", r._id)),
		...notificationsToDelete.map((n) => ctx.db.delete("notifications", n._id)),
		...Array.from(relationIdsToDelete).map((relationId) =>
			ctx.db.delete("taskRelations", relationId),
		),
		...taskActivityLogs.map((l) => ctx.db.delete("activityLog", l._id)),
	]);

	await Promise.all(
		taskIdArray.map((taskId) => deleteCommentsAndReplies(ctx, "task", taskId)),
	);
	await deleteEntitySubscriptions(
		ctx,
		"task",
		taskIdArray.map((taskId) => `${taskId}`),
	);

	for (const taskId of taskIdArray) {
		await ctx.db.delete("tasks", taskId);
	}
}
