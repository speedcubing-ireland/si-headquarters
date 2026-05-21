import type { Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { requireUserId } from "../../core/auth"

type Ctx = QueryCtx | MutationCtx

export async function isSponsorshipManager(ctx: Ctx): Promise<boolean> {
  try {
    await requireUserId(ctx)
    return true
  } catch {
    return false
  }
}

export async function requireSponsorshipManager(
  ctx: Ctx
): Promise<Id<"users">> {
  return await requireUserId(ctx)
}
