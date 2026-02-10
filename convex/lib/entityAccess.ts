import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type EntityAccessArgs =
	| { entityType: "task"; entityId: Id<"tasks"> }
	| { entityType: "update"; entityId: Id<"competitionUpdates"> };

export async function checkEntityAccess(
	ctx: QueryCtx,
	entity: EntityAccessArgs,
	volunteer: boolean,
	hasAccessFn: (
		ctx: QueryCtx,
		volunteer: boolean,
		competitionId: string,
	) => Promise<boolean>,
): Promise<boolean> {
	if (volunteer) return true;

	let competitionId: string | null | undefined;
	if (entity.entityType === "task") {
		const task = await ctx.db.get("tasks", entity.entityId);
		competitionId = task?.parentCompetitionId;
	} else {
		const update = await ctx.db.get("competitionUpdates", entity.entityId);
		competitionId = update?.competitionId;
	}

	if (!competitionId) return false;
	return hasAccessFn(ctx, volunteer, competitionId);
}

export const taskAccess = {
	checkAccess: (
		ctx: QueryCtx,
		entityId: Id<"tasks">,
		volunteer: boolean,
		hasAccessFn: (
			ctx: QueryCtx,
			volunteer: boolean,
			competitionId: string,
		) => Promise<boolean>,
	) =>
		checkEntityAccess(
			ctx,
			{ entityType: "task", entityId },
			volunteer,
			hasAccessFn,
		),
};

export const updateAccess = {
	checkAccess: (
		ctx: QueryCtx,
		entityId: Id<"competitionUpdates">,
		volunteer: boolean,
		hasAccessFn: (
			ctx: QueryCtx,
			volunteer: boolean,
			competitionId: string,
		) => Promise<boolean>,
	) =>
		checkEntityAccess(
			ctx,
			{ entityType: "update", entityId },
			volunteer,
			hasAccessFn,
		),
};
