import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { userCanAccessCompetitionDoc } from "./competitionAccess";

export const ERROR_TASK_NO_COMPETITION =
	"Only volunteers can modify tasks without a competition";
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
	if (isVolunteer) return true;
	if (!competitionId) return false;

	const competition = await ctx.db.get("competitions", competitionId);
	if (!competition) return false;

	return userCanAccessCompetitionDoc(competition, userId);
}

export async function listOrganisedCompetitionIds(
	ctx: TaskAccessCtx,
	userId: Id<"users">,
): Promise<Id<"competitions">[]> {
	const competitions = await ctx.db.query("competitions").collect();
	return competitions
		.filter((competition) => userCanAccessCompetitionDoc(competition, userId))
		.map((competition) => competition._id);
}

export async function requireTaskAccess(
	ctx: MutationCtx,
	volunteer: boolean,
	userId: Id<"users">,
	task: Doc<"tasks">,
): Promise<void> {
	if (volunteer) return;

	if (!task.parentCompetitionId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: ERROR_TASK_NO_COMPETITION,
		});
	}

	const hasAccess = await hasTaskCompetitionAccess(
		ctx,
		volunteer,
		userId,
		task.parentCompetitionId,
	);
	if (!hasAccess) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: ERROR_TASK_NO_ACCESS,
		});
	}
}
