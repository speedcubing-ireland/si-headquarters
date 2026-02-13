import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { TEAM_NAMES } from "./constants";

type Ctx = QueryCtx | MutationCtx;

async function isMemberOfTeam(
	ctx: Ctx,
	userId: Id<"users">,
	teamName: string,
): Promise<boolean> {
	const team = await ctx.db
		.query("teams")
		.withIndex("by_name", (q) => q.eq("name", teamName))
		.unique();
	if (!team) return false;
	return team.memberIds.includes(userId);
}

export async function isSponsorshipManager(ctx: Ctx): Promise<boolean> {
	const userId = await getAuthUserId(ctx);
	if (!userId) return false;
	const [isDirector, isFinance] = await Promise.all([
		isMemberOfTeam(ctx, userId, TEAM_NAMES.DIRECTORS),
		isMemberOfTeam(ctx, userId, TEAM_NAMES.FINANCE),
	]);
	return isDirector || isFinance;
}

export async function requireSponsorshipManager(
	ctx: Ctx,
): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) {
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Authentication required",
		});
	}
	const allowed = await isSponsorshipManager(ctx);
	if (!allowed) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Directors or Finance Team only.",
		});
	}
	return userId;
}
