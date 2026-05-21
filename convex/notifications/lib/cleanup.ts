import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

export type SubscribedEntityType = "task" | "competition" | "comment";
export type NotificationEntityType =
	| "task"
	| "competition"
	| "comment"
	| "reminder";

export async function deleteNotificationArtifactsForEntity(
	_ctx: MutationCtx,
	_entity: {
		entityType: NotificationEntityType;
		entityId: string;
	},
): Promise<void> {
	return;
}

export async function deleteNotificationArtifactsForNotifications(): Promise<void> {
	return;
}

export async function deleteNotificationArtifactsForTaskTree(
	ctx: MutationCtx,
	args: {
		taskIds: Id<"tasks">[];
		commentIds: Id<"comments">[];
		reminderIds: Id<"reminders">[];
	},
): Promise<void> {
	const refs = [
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
	];

	for (const ref of refs) {
		await deleteNotificationArtifactsForEntity(ctx, ref);
	}
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

	const uniqueSubscriptionIds = new Set(
		subscriptionRows.map((subscriptionRow) => subscriptionRow._id),
	);
	await Promise.all(
		[...uniqueSubscriptionIds].map((subscriptionId) =>
			ctx.db.delete("notificationSubscriptions", subscriptionId),
		),
	);
}
