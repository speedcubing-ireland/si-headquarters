import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type TaskUpdateSnapshot = {
	status?: Doc<"tasks">["status"];
	priority?: Doc<"tasks">["priority"];
	assigneeId?: Id<"users"> | null;
	dueDate?: string | null;
	phaseId?: Id<"phases"> | null;
	labelIds?: Id<"labels">[];
};

export type TaskActivityLogPayload = {
	entityType: "task";
	entityId: Id<"tasks">;
	type: string;
	oldValue?: string;
	newValue?: string;
};

export async function getTaskUpdateActivityLogPayloads(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	doc: Doc<"tasks">,
	updates: TaskUpdateSnapshot,
	finalStatus: string,
	oldAssigneeId: Id<"users"> | undefined,
	newAssigneeId: Id<"users"> | undefined,
): Promise<TaskActivityLogPayload[]> {
	const payloads: TaskActivityLogPayload[] = [];
	const oldStatus = doc.status;

	if (updates.status !== undefined && oldStatus !== finalStatus) {
		payloads.push({
			entityType: "task",
			entityId: taskId,
			type: "status_changed",
			oldValue: oldStatus,
			newValue: finalStatus,
		});
	}
	if (updates.priority !== undefined && doc.priority !== updates.priority) {
		payloads.push({
			entityType: "task",
			entityId: taskId,
			type: "priority_changed",
			oldValue: doc.priority,
			newValue: updates.priority,
		});
	}
	if (oldAssigneeId !== newAssigneeId) {
		const [oldUser, newUser] = await Promise.all([
			oldAssigneeId ? ctx.db.get("users", oldAssigneeId) : null,
			newAssigneeId ? ctx.db.get("users", newAssigneeId) : null,
		]);
		payloads.push({
			entityType: "task",
			entityId: taskId,
			type: "assignee_changed",
			oldValue: oldUser?.name ?? undefined,
			newValue: newUser?.name ?? undefined,
		});
	}
	if (updates.dueDate !== undefined) {
		payloads.push({
			entityType: "task",
			entityId: taskId,
			type: "due_date_changed",
			oldValue: doc.dueDate,
			newValue: updates.dueDate ?? undefined,
		});
	}
	if (
		updates.phaseId !== undefined &&
		doc.phaseId !== (updates.phaseId ?? undefined)
	) {
		payloads.push({
			entityType: "task",
			entityId: taskId,
			type: "phase_changed",
			oldValue: doc.phaseId,
			newValue: updates.phaseId ?? undefined,
		});
	}
	if (updates.labelIds !== undefined) {
		const oldIds = new Set(doc.labelIds ?? []);
		const newIdsSet = new Set(updates.labelIds);
		const added = updates.labelIds.filter((id) => !oldIds.has(id));
		const removed = (doc.labelIds ?? []).filter((id) => !newIdsSet.has(id));
		const labelIdsToResolve = [...added, ...removed];
		const labelDocs = await Promise.all(
			labelIdsToResolve.map((id) => ctx.db.get("labels", id)),
		);
		const idToName = new Map<Id<"labels">, string>();
		labelIdsToResolve.forEach((id, i) => {
			const l = labelDocs[i];
			if (l) idToName.set(id as Id<"labels">, l.name);
		});
		for (const id of added) {
			payloads.push({
				entityType: "task",
				entityId: taskId,
				type: "label_added",
				newValue: idToName.get(id as Id<"labels">) ?? id,
			});
		}
		for (const id of removed) {
			payloads.push({
				entityType: "task",
				entityId: taskId,
				type: "label_removed",
				oldValue: idToName.get(id as Id<"labels">) ?? id,
			});
		}
	}
	return payloads;
}
