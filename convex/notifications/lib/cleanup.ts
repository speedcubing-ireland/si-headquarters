import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

export type SubscribedEntityType = "task" | "competition" | "comment";
export type NotificationEntityType =
	| "task"
	| "competition"
	| "comment"
	| "reminder";

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

export async function deleteNotificationArtifactsForNotifications(
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

export async function deleteNotificationArtifactsForTaskTree(
	ctx: MutationCtx,
	args: {
		taskIds: Id<"tasks">[];
		commentIds: Id<"comments">[];
		reminderIds: Id<"reminders">[];
	},
): Promise<void> {
	if (
		args.taskIds.length === 0 &&
		args.commentIds.length === 0 &&
		args.reminderIds.length === 0
	) {
		return;
	}

	const notificationsByTaskEntity = (
		await Promise.all(
			args.taskIds.map((taskId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "task").eq("entityId", `${taskId}`),
					)
					.collect(),
			),
		)
	).flat();

	const notificationsByTaskParent = (
		await Promise.all(
			args.taskIds.map((taskId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_parent_entity", (q) =>
						q.eq("parentEntityId", `${taskId}`),
					)
					.collect(),
			),
		)
	).flat();

	const notificationsByCommentEntity = (
		await Promise.all(
			args.commentIds.map((commentId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "comment").eq("entityId", `${commentId}`),
					)
					.collect(),
			),
		)
	).flat();

	const notificationsByReminderEntity = (
		await Promise.all(
			args.reminderIds.map((reminderId) =>
				ctx.db
					.query("notifications")
					.withIndex("by_entity", (q) =>
						q.eq("entityType", "reminder").eq("entityId", `${reminderId}`),
					)
					.collect(),
			),
		)
	).flat();

	const notifications = dedupeById([
		...notificationsByTaskEntity,
		...notificationsByTaskParent,
		...notificationsByCommentEntity,
		...notificationsByReminderEntity,
	]);

	await deleteNotificationArtifactsForNotifications(ctx, notifications, [
		...args.taskIds.map((taskId) => ({
			entityType: "task" as const,
			entityId: `${taskId}`,
		})),
		...args.commentIds.map((commentId) => ({
			entityType: "comment" as const,
			entityId: `${commentId}`,
		})),
		...args.reminderIds.map((reminderId) => ({
			entityType: "reminder" as const,
			entityId: `${reminderId}`,
		})),
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
