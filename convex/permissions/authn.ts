import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"

export type AuthnCtx = QueryCtx | MutationCtx

/** Returns the Convex Auth user id, or null when unauthenticated. */
export async function getUserIdOrNull(
  ctx: AuthnCtx,
): Promise<Id<"users"> | null> {
  return getAuthUserId(ctx)
}

/** Requires a signed-in volunteer user; throws UNAUTHENTICATED otherwise. */
export async function requireAuthenticatedUserId(
  ctx: AuthnCtx,
): Promise<Id<"users">> {
  const userId = await getUserIdOrNull(ctx)
  if (userId === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    })
  }
  return userId
}

/** Alias for requireAuthenticatedUserId. */
export const requireUserId = requireAuthenticatedUserId
