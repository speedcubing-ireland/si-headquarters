import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { hasCompetitionAccess } from "../../competitions/access";
import { getCommentParentId } from "../commentParentId";
import { throwForbidden } from "./require";

type ResourceCtx = QueryCtx | MutationCtx;

export async function canAccessCompetitionResource(
	ctx: ResourceCtx,
	args: {
		userId: Id<"users">;
		competitionId: Id<"competitions"> | null | undefined;
		isVolunteer: boolean;
	},
): Promise<boolean> {
	return hasCompetitionAccess(
		ctx,
		args.isVolunteer,
		args.userId,
		args.competitionId,
	);
}

export async function requireCompetitionResourceAccess(
	ctx: ResourceCtx,
	args: {
		userId: Id<"users">;
		competitionId: Id<"competitions"> | null | undefined;
		isVolunteer: boolean;
		forbiddenMessage: string;
	},
): Promise<void> {
	const hasAccess = await canAccessCompetitionResource(ctx, args);
	if (!hasAccess) {
		throwForbidden(args.forbiddenMessage);
	}
}

export async function lookupCommentParentCompetitionId(
	ctx: ResourceCtx,
	parentType: "task" | "update",
	parentId: string,
): Promise<Id<"competitions"> | undefined> {
	if (parentType === "task") {
		const task = await ctx.db.get(
			"tasks",
			getCommentParentId("task", parentId),
		);
		return task?.parentCompetitionId ?? undefined;
	}
	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", parentId),
	);
	return update?.competitionId;
}
