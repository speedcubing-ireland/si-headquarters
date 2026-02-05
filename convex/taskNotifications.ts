import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Returns scheduler promises for unassign (old assignee) and assign (new assignee)
 * when assignee changed. Caller should only call when oldAssigneeId !== newAssigneeId.
 */
export function getTaskAssigneeChangeNotificationPromises(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	oldAssigneeId: Id<"users"> | undefined,
	newAssigneeId: Id<"users"> | undefined,
	actorId: Id<"users">,
): Promise<unknown>[] {
	const promises: Promise<unknown>[] = [];
	if (oldAssigneeId && oldAssigneeId !== actorId) {
		promises.push(
			ctx.scheduler.runAfter(0, internal.notifications._notifyTaskUnassigned, {
				taskId,
				assigneeId: oldAssigneeId,
				actorId,
			}),
		);
	}
	if (newAssigneeId && newAssigneeId !== actorId) {
		promises.push(
			ctx.scheduler.runAfter(0, internal.notifications._notifyTaskAssigned, {
				taskId,
				assigneeId: newAssigneeId,
				actorId,
			}),
		);
	}
	return promises;
}

/**
 * Returns scheduler promises for status-change notifications to assignee and owner.
 * Caller should only call when status actually changed and was explicitly updated.
 */
export function getTaskStatusChangeNotificationPromises(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	oldStatus: string,
	newStatus: string,
	actorId: Id<"users">,
): Promise<unknown>[] {
	const recipients = new Set<Id<"users">>();
	if (doc.assigneeId && doc.assigneeId !== actorId) {
		recipients.add(doc.assigneeId);
	}
	if (doc.ownerId && doc.ownerType === "user" && doc.ownerId !== actorId) {
		recipients.add(doc.ownerId as Id<"users">);
	}
	return recipients.size === 0
		? []
		: [...recipients].map((recipientId) =>
				ctx.scheduler.runAfter(
					0,
					internal.notifications._notifyTaskStatusChanged,
					{
						taskId,
						recipientId,
						actorId,
						oldStatus,
						newStatus,
					},
				),
			);
}
