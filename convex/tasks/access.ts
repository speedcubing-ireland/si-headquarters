import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	hasCompetitionAccess,
	listAccessibleCompetitionIds,
} from "../competitionAccess";
import { requireCompetitionResourceAccess } from "../lib/permissions/resources";

export const ERROR_TASK_NO_COMPETITION =
	"You can only modify standalone tasks assigned to you";
export const ERROR_TASK_NO_ACCESS =
	"You can only modify tasks linked to competitions you are organizing";
export const ERROR_TASK_MOVE =
	"You can only move tasks to competitions you are organizing";

type TaskAccessCtx = QueryCtx | MutationCtx;

export async function hasTaskCompetitionAccess(
	ctx: TaskAccessCtx,
	isVolunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions"> | null | undefined,
): Promise<boolean> {
	return hasCompetitionAccess(ctx, isVolunteer, userId, competitionId);
}

export async function listOrganisedCompetitionIds(
	ctx: TaskAccessCtx,
	userId: Id<"users">,
): Promise<Id<"competitions">[]> {
	return listAccessibleCompetitionIds(ctx, userId);
}

export async function requireTaskAccess(
	ctx: TaskAccessCtx,
	volunteer: boolean,
	userId: Id<"users">,
	task: Doc<"tasks">,
): Promise<void> {
	const hasAccess = await hasTaskWriteAccess(ctx, volunteer, userId, task);
	if (!hasAccess) {
		const message = task.parentCompetitionId
			? ERROR_TASK_NO_ACCESS
			: ERROR_TASK_NO_COMPETITION;
		throw new ConvexError({
			code: "FORBIDDEN",
			message,
		});
	}
}

export async function hasTaskWriteAccess(
	ctx: TaskAccessCtx,
	volunteer: boolean,
	userId: Id<"users">,
	task: Doc<"tasks">,
): Promise<boolean> {
	if (volunteer) return true;
	if (!task.parentCompetitionId) {
		return hasStandaloneTaskAccess(task, userId);
	}
	return hasTaskCompetitionAccess(
		ctx,
		volunteer,
		userId,
		task.parentCompetitionId,
	);
}

export function hasStandaloneTaskAccess(
	task: Doc<"tasks">,
	userId: Id<"users">,
): boolean {
	if (task.parentCompetitionId) return false;
	if (task.assigneeId === userId) return true;
	return task.ownerType === "user" && task.ownerId === userId;
}

export async function requireCompetitionTaskAccess(
	ctx: TaskAccessCtx,
	args: {
		userId: Id<"users">;
		competitionId: Id<"competitions"> | null | undefined;
		volunteer: boolean;
		forbiddenMessage: string;
	},
): Promise<void> {
	await requireCompetitionResourceAccess(ctx, {
		userId: args.userId,
		competitionId: args.competitionId,
		isVolunteer: args.volunteer,
		forbiddenMessage: args.forbiddenMessage,
	});
}
