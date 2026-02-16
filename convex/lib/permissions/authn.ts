import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export type AuthnCtx = QueryCtx | MutationCtx;

export async function getUserIdOrNull(
	ctx: AuthnCtx,
): Promise<Id<"users"> | null> {
	return getAuthUserId(ctx);
}

export async function requireAuthenticatedUserId(
	ctx: AuthnCtx,
): Promise<Id<"users">> {
	const userId = await getUserIdOrNull(ctx);
	if (userId === null) {
		throw new ConvexError({
			code: "UNAUTHENTICATED",
			message: "Authentication required",
		});
	}
	return userId;
}
