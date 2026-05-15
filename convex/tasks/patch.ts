import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { computeApprovalCompleteness } from "./approvalLogic";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { taskStatus, taskPriority, linkedResource } from "../lib/validators";

export const taskUpdateArgs = {
	title: v.optional(v.string()),
	description: v.optional(v.string()),
	status: v.optional(taskStatus),
	priority: v.optional(taskPriority),
	dueDate: v.optional(v.union(v.string(), v.null())),
	parentTaskId: v.optional(v.union(v.id("tasks"), v.null())),
	parentCompetitionId: v.optional(v.union(v.id("competitions"), v.null())),
	ownerId: v.optional(v.union(v.id("users"), v.id("teams"), v.null())),
	ownerType: v.optional(v.union(v.literal("user"), v.literal("team"))),
	assigneeId: v.optional(v.union(v.id("users"), v.null())),
	phaseId: v.optional(v.union(v.id("phases"), v.null())),
	labelIds: v.optional(v.array(v.id("labels"))),
	resources: v.optional(v.array(linkedResource)),
};

const taskUpdateValidator = v.object(taskUpdateArgs);
export type TaskUpdate = Infer<typeof taskUpdateValidator>;

export type TaskPatch = TaskUpdate & { updatedAt: number };

export type TaskPatchForDb = Omit<
	TaskPatch,
	| "dueDate"
	| "parentTaskId"
	| "parentCompetitionId"
	| "ownerId"
	| "assigneeId"
	| "phaseId"
> & {
	dueDate?: string;
	parentTaskId?: Id<"tasks">;
	parentCompetitionId?: Id<"competitions">;
	ownerId?: Id<"users"> | Id<"teams">;
	assigneeId?: Id<"users">;
	phaseId?: Id<"phases">;
	updatedAt: number;
};

export function buildTaskPatch(
	updates: TaskUpdate,
	updatedAt: number,
): TaskPatchForDb {
	const result: Record<string, unknown> = { updatedAt };

	if (updates.title !== undefined) result.title = updates.title;
	if (updates.description !== undefined)
		result.description = updates.description;
	if (updates.status !== undefined) result.status = updates.status;
	if (updates.priority !== undefined) result.priority = updates.priority;
	if (updates.ownerType !== undefined) result.ownerType = updates.ownerType;
	if (updates.labelIds !== undefined) result.labelIds = updates.labelIds;
	if (updates.resources !== undefined) result.resources = updates.resources;

	if (updates.dueDate !== undefined) {
		result.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
	}
	if (updates.parentTaskId !== undefined) {
		result.parentTaskId =
			updates.parentTaskId === null ? undefined : updates.parentTaskId;
	}
	if (updates.parentCompetitionId !== undefined) {
		result.parentCompetitionId =
			updates.parentCompetitionId === null
				? undefined
				: updates.parentCompetitionId;
	}
	if (updates.ownerId !== undefined) {
		result.ownerId = updates.ownerId === null ? undefined : updates.ownerId;
	}
	if (updates.assigneeId !== undefined) {
		result.assigneeId =
			updates.assigneeId === null ? undefined : updates.assigneeId;
	}
	if (updates.phaseId !== undefined) {
		result.phaseId = updates.phaseId === null ? undefined : updates.phaseId;
	}

	return result as TaskPatchForDb;
}

export async function applyAwaitingReviewAutoPromote(
	ctx: MutationCtx,
	doc: Doc<"tasks">,
	patch: TaskPatch,
): Promise<void> {
	if (patch.status !== "awaiting-review") return;
	const { isFullyApproved } = await computeApprovalCompleteness(
		ctx,
		doc.requiredApprovalIds ?? [],
		doc.approvedByIds ?? [],
	);
	if (
		isFullyApproved &&
		doc.requiredApprovalIds &&
		doc.requiredApprovalIds.length > 0
	) {
		patch.status = "done";
	}
}
