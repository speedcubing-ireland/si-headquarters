import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  PERMISSION_KEYS,
  requirePermission,
} from "@/convex/permissions/authorize"

type AuthorizeCtx = QueryCtx | MutationCtx

export { PERMISSION_KEYS as SPONSOR_PERMISSION_KEYS }

export async function requireSponsorshipManager(
  ctx: AuthorizeCtx,
  message?: string,
): Promise<Id<"users">> {
  return requirePermission(ctx, PERMISSION_KEYS.SPONSORSHIP_MANAGER, message)
}
