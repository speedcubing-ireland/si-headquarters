import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

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
