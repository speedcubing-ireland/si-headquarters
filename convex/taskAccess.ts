import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { hasCompetitionAccess } from "./competitionAccess";

export const ERROR_TASK_NO_COMPETITION =
	"Only volunteers can modify tasks without a competition";
export const ERROR_TASK_NO_ACCESS =
	"You can only modify tasks linked to competitions you are organizing";
export const ERROR_TASK_MOVE =
	"You can only move tasks to competitions you are organizing";

export { hasCompetitionAccess } from "./competitionAccess";

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

	const hasAccess = await hasCompetitionAccess(
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
