import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import type { Id } from "@/convex/_generated/dataModel"

type AuthCtx = QueryCtx | MutationCtx

export async function requireUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new Error("Authentication required")
  }
  return userId
}
