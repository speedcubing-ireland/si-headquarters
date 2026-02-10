import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { collectTaskRecipients } from "./lib/recipientCollection";

export async function sendTaskAssigneeChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	oldAssigneeId: Id<"users"> | undefined,
	newAssigneeId: Id<"users"> | undefined,
	actorId: Id<"users">,
): Promise<void> {
	if (oldAssigneeId && oldAssigneeId !== actorId) {
		await ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskUnassigned,
			{ taskId, assigneeId: oldAssigneeId, actorId },
		);
	}
	if (newAssigneeId && newAssigneeId !== actorId) {
		await ctx.scheduler.runAfter(
			0,
			internal.notifications._notifyTaskAssigned,
			{ taskId, assigneeId: newAssigneeId, actorId },
		);
	}
}

export async function sendTaskStatusChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldStatus: string,
	newStatus: string,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = collectTaskRecipients(doc, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyTaskStatusChanged,
		{
			taskId,
			recipientIds,
			actorId,
			oldStatus,
			newStatus,
			eventKey: `${taskId}:${oldStatus}:${newStatus}:${Date.now()}`,
		},
	);
}

export async function sendTaskPriorityChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldPriority: string,
	newPriority: string,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = collectTaskRecipients(doc, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyTaskPriorityChanged,
		{
			taskId,
			recipientIds,
			actorId,
			oldPriority,
			newPriority,
			eventKey: `${taskId}:${oldPriority}:${newPriority}:${Date.now()}`,
		},
	);
}

async function getRelationRecipients(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<Id<"users">[]> {
	const blockedTask = await ctx.db.get("tasks", blockedTaskId);
	if (!blockedTask) return [];
	return collectTaskRecipients(blockedTask, actorId);
}

export async function sendTaskRelationBlockedNotifications(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = await getRelationRecipients(ctx, blockedTaskId, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyTaskRelationBlocked,
		{
			blockedTaskId,
			blockingTaskId,
			recipientIds,
			actorId,
			eventKey: `${blockedTaskId}:${blockingTaskId}:blocked:${Date.now()}`,
		},
	);
}

export async function sendTaskRelationUnblockedNotifications(
	ctx: MutationCtx,
	blockedTaskId: Id<"tasks">,
	blockingTaskId: Id<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = await getRelationRecipients(ctx, blockedTaskId, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyTaskRelationUnblocked,
		{
			blockedTaskId,
			blockingTaskId,
			recipientIds,
			actorId,
			eventKey: `${blockedTaskId}:${blockingTaskId}:unblocked:${Date.now()}`,
		},
	);
}

export async function sendTaskApprovalNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	task: Doc<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = collectTaskRecipients(task, actorId);
	await ctx.scheduler.runAfter(0, internal.notifications._notifyTaskApproved, {
		taskId,
		recipientIds,
		actorId,
		eventKey: `${taskId}:approved:${Date.now()}`,
	});
}

export async function sendTaskUnapprovalNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	task: Doc<"tasks">,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = collectTaskRecipients(task, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyTaskUnapproved,
		{
			taskId,
			recipientIds,
			actorId,
			eventKey: `${taskId}:unapproved:${Date.now()}`,
		},
	);
}

export async function sendDueDateChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldDueDate: string | undefined,
	newDueDate: string | undefined,
	actorId: Id<"users">,
): Promise<void> {
	const recipientIds = collectTaskRecipients(doc, actorId);
	await ctx.scheduler.runAfter(
		0,
		internal.notifications._notifyDueDateChanged,
		{
			taskId,
			recipientIds,
			actorId,
			oldDueDate,
			newDueDate,
			eventKey: `${taskId}:due_date:${Date.now()}`,
		},
	);
}
