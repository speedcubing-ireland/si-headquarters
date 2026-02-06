import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

function collectTaskNotificationRecipients(
	task: Pick<Doc<"tasks">, "assigneeId" | "ownerId" | "ownerType">,
	actorId: Id<"users">,
): Set<Id<"users">> {
	const recipients = new Set<Id<"users">>();
	if (task.assigneeId && task.assigneeId !== actorId) {
		recipients.add(task.assigneeId);
	}
	if (task.ownerId && task.ownerType === "user" && task.ownerId !== actorId) {
		recipients.add(task.ownerId as Id<"users">);
	}
	return recipients;
}

export function sendTaskAssigneeChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	oldAssigneeId: Id<"users"> | undefined,
	newAssigneeId: Id<"users"> | undefined,
	actorId: Id<"users">,
): void {
	if (oldAssigneeId && oldAssigneeId !== actorId) {
		void ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskUnassigned,
			{
				taskId,
				assigneeId: oldAssigneeId,
				actorId,
			},
		);
	}
	if (newAssigneeId && newAssigneeId !== actorId) {
		void ctx.scheduler.runAfter(0, internal.notifications._notifyTaskAssigned, {
			taskId,
			assigneeId: newAssigneeId,
			actorId,
		});
	}
}

export function sendTaskStatusChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldStatus: string,
	newStatus: string,
	actorId: Id<"users">,
): void {
	const recipients = collectTaskNotificationRecipients(doc, actorId);
	for (const recipientId of recipients) {
		void ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskStatusChanged,
			{
				taskId,
				recipientId,
				actorId,
				oldStatus,
				newStatus,
			},
		);
	}
}

async function getRelationNotificationRecipients(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<Set<Id<"users">>> {
	const blockedTask = await ctx.db.get("tasks", blockedTaskId);
	if (!blockedTask) {
		return new Set();
	}
	return collectTaskNotificationRecipients(blockedTask, actorId);
}

export async function sendTaskRelationBlockedNotifications(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipients = await getRelationNotificationRecipients(
		ctx,
		blockedTaskId,
		actorId,
	);
	for (const recipientId of recipients) {
		void ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskRelationBlocked,
			{
				blockedTaskId,
				blockingTaskId,
				recipientId,
				actorId,
			},
		);
	}
}

export async function sendTaskRelationUnblockedNotifications(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipients = await getRelationNotificationRecipients(
		ctx,
		blockedTaskId,
		actorId,
	);
	for (const recipientId of recipients) {
		void ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskRelationUnblocked,
			{
				blockedTaskId,
				blockingTaskId,
				recipientId,
				actorId,
			},
		);
	}
}
