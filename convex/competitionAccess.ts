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

type CompetitionAccessCtx = QueryCtx | MutationCtx;

export function competitionAccessUserIds(
	comp: Pick<
		Doc<"competitions">,
		"organiserIds" | "compLeadId" | "leadDelegateId"
	>,
): Id<"users">[] {
	const userIds = new Set<Id<"users">>();
	if (comp.compLeadId) userIds.add(comp.compLeadId);
	if (comp.leadDelegateId) userIds.add(comp.leadDelegateId);
	for (const organiserId of comp.organiserIds) {
		userIds.add(organiserId);
	}
	return [...userIds];
}

export async function listAccessibleCompetitionIds(
	ctx: CompetitionAccessCtx,
	userId: Id<"users">,
): Promise<Id<"competitions">[]> {
	const accessRows = await ctx.db
		.query("competitionAccess")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.collect();
	return [...new Set(accessRows.map((row) => row.competitionId))];
}

export async function hasCompetitionAccess(
	ctx: CompetitionAccessCtx,
	isVolunteer: boolean,
	userId: Id<"users">,
	competitionId: Id<"competitions"> | null | undefined,
): Promise<boolean> {
	if (isVolunteer) return true;
	if (!competitionId) return false;

	const accessRow = await ctx.db
		.query("competitionAccess")
		.withIndex("by_user_and_competition", (q) =>
			q.eq("userId", userId).eq("competitionId", competitionId),
		)
		.first();
	return accessRow !== null;
}

export async function syncCompetitionAccessRows(
	ctx: MutationCtx,
	competitionId: Id<"competitions">,
	userIds: Id<"users">[],
): Promise<void> {
	const targetUserIds = [...new Set(userIds)];
	const existingRows = await ctx.db
		.query("competitionAccess")
		.withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
		.collect();
	const existingByUser = new Map(existingRows.map((row) => [row.userId, row]));
	const targetSet = new Set(targetUserIds);

	const inserts = targetUserIds
		.filter((userId) => !existingByUser.has(userId))
		.map((userId) =>
			ctx.db.insert("competitionAccess", {
				competitionId,
				userId,
			}),
		);

	const deletes = existingRows
		.filter((row) => !targetSet.has(row.userId))
		.map((row) => ctx.db.delete("competitionAccess", row._id));

	await Promise.all([...inserts, ...deletes]);
}

export async function deleteCompetitionAccessRows(
	ctx: MutationCtx,
	competitionId: Id<"competitions">,
): Promise<void> {
	const rows = await ctx.db
		.query("competitionAccess")
		.withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
		.collect();
	await Promise.all(
		rows.map((row) => ctx.db.delete("competitionAccess", row._id)),
	);
}
