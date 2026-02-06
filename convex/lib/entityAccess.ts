import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type AccessStrategy<T extends "tasks" | "competitionUpdates"> = {
	getCompetitionId: (
		ctx: QueryCtx,
		id: Id<T>,
	) => Promise<string | null | undefined>;
};

const accessStrategies: {
	task: AccessStrategy<"tasks">;
	update: AccessStrategy<"competitionUpdates">;
} = {
	task: {
		getCompetitionId: async (ctx, id) => {
			const task = await ctx.db.get("tasks", id);
			return task?.parentCompetitionId;
		},
	},
	update: {
		getCompetitionId: async (ctx, id) => {
			const update = await ctx.db.get("competitionUpdates", id);
			return update?.competitionId;
		},
	},
};

export async function checkEntityAccess(
	ctx: QueryCtx,
	entityType: keyof typeof accessStrategies,
	entityId: Id<"tasks"> | Id<"competitionUpdates">,
	volunteer: boolean,
	hasAccessFn: (
		ctx: QueryCtx,
		volunteer: boolean,
		competitionId: string,
	) => Promise<boolean>,
): Promise<boolean> {
	if (volunteer) return true;

	const strategy = accessStrategies[entityType];
	if (!strategy) return false;

	const competitionId = await strategy.getCompetitionId(
		ctx,
		entityId as Id<"tasks"> & Id<"competitionUpdates">,
	);
	if (!competitionId) return false;

	return hasAccessFn(ctx, volunteer, competitionId);
}

export function createEntityAccessChecker<
	T extends keyof typeof accessStrategies,
>(entityType: T) {
	return {
		checkAccess: async (
			ctx: QueryCtx,
			entityId: Id<"tasks"> | Id<"competitionUpdates">,
			volunteer: boolean,
			hasAccessFn: (
				ctx: QueryCtx,
				volunteer: boolean,
				competitionId: string,
			) => Promise<boolean>,
		) => checkEntityAccess(ctx, entityType, entityId, volunteer, hasAccessFn),
	};
}

export const taskAccess = createEntityAccessChecker("task");
export const updateAccess = createEntityAccessChecker("update");
