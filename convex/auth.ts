import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [Google],
});

/**
 * Require that the caller is authenticated and return their user id.
 * Throws a ConvexError if no authenticated user is present.
 */
export async function requireUserId(
	ctx: QueryCtx | MutationCtx,
): Promise<ReturnType<typeof getAuthUserId> extends Promise<infer T> ? T : never> {
	const userId = await getAuthUserId(ctx);
	if (userId === null) {
		throw new ConvexError("Authentication required");
	}
	return userId as never;
}
