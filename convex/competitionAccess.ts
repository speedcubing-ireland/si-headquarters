import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Sync check: does this user have access to this competition (organiser/lead/delegate)?
 * Use when you already have the competition doc. For async (fetch by id) use hasCompetitionAccess.
 */
export function userCanAccessCompetitionDoc(
	comp: Doc<"competitions">,
	userId: Id<"users">,
): boolean {
	return (
		comp.organiserIds.includes(userId) ||
		comp.compLeadId === userId ||
		comp.leadDelegateId === userId
	);
}

/**
 * Check if a user has access to a competition (volunteer or organiser/lead/delegate).
 * Use from queries/mutations when you have competitionId.
 */
export async function hasCompetitionAccess(
	ctx: QueryCtx | MutationCtx,
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
