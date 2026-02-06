import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Fire notification for unassign (old assignee) and assign (new assignee)
 * when assignee changed. Caller should only call when oldAssigneeId !== newAssigneeId.
 */
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

/**
 * Fire status-change notifications to assignee and owner.
 * Caller should only call when status actually changed and was explicitly updated.
 */
export function sendTaskStatusChangeNotifications(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldStatus: string,
	newStatus: string,
	actorId: Id<"users">,
): void {
	const recipients = new Set<Id<"users">>();
	if (doc.assigneeId && doc.assigneeId !== actorId) {
		recipients.add(doc.assigneeId);
	}
	if (doc.ownerId && doc.ownerType === "user" && doc.ownerId !== actorId) {
		recipients.add(doc.ownerId as Id<"users">);
	}
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
