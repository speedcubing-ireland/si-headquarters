import { ConvexError } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { OAuthService } from "@/convex/integrations/validators"
import { SERVICE_ACCOUNT_OAUTH_ATTEMPT_TTL_MS } from "@/convex/integrations/serviceAccountPaths"
import { createToken, hashToken } from "@/convex/tokens"

// One message for every rejection path so the callback endpoint cannot be used
// to probe which states exist, which have expired, and which belong to someone
// else.
export const INVALID_CONNECTION_REQUEST_MESSAGE =
  "This connection request is invalid, expired, or already used. Start again from Admin → Service accounts."

export function invalidConnectionRequest(): never {
  throw new ConvexError({
    code: "BAD_REQUEST",
    message: INVALID_CONNECTION_REQUEST_MESSAGE,
  })
}

export type ConsumeOAuthAttemptResult =
  | { status: "ok"; service: OAuthService; codeVerifier: string | undefined }
  | { status: "invalid" }

/**
 * Starts an attempt and returns the raw state to send to the provider. Only the
 * hash is persisted, so a state recovered from browser history or a `Referer`
 * header cannot be matched back to a stored row.
 */
export async function createOAuthAttempt(
  ctx: MutationCtx,
  args: {
    service: OAuthService
    codeVerifier: string | undefined
    userId: Id<"users">
  }
): Promise<string> {
  // Drop this director's stale rows and any earlier attempt for the same
  // service, so the table stays at roughly one row per director per in-flight
  // service instead of accumulating abandoned attempts.
  const now = Date.now()
  const existing = await ctx.db
    .query("serviceOAuthAttempts")
    .withIndex("by_createdByUserId", (q) =>
      q.eq("createdByUserId", args.userId)
    )
    .collect()
  for (const attempt of existing) {
    if (attempt.expiresAt <= now || attempt.service === args.service) {
      await ctx.db.delete("serviceOAuthAttempts", attempt._id)
    }
  }

  const state = createToken()
  await ctx.db.insert("serviceOAuthAttempts", {
    stateHash: await hashToken(state),
    service: args.service,
    codeVerifier: args.codeVerifier,
    createdByUserId: args.userId,
    expiresAt: now + SERVICE_ACCOUNT_OAUTH_ATTEMPT_TTL_MS,
  })
  return state
}

/**
 * Validates and burns an attempt. The row is deleted in the same transaction it
 * is read in — Convex mutations are serializable, so a replayed state finds
 * nothing.
 *
 * Rejection is reported as a return value rather than thrown: a `ConvexError`
 * would roll the transaction back, which would un-delete the row and leave a
 * state redeemed by the wrong director still usable. The caller turns
 * `"invalid"` into `invalidConnectionRequest()` once the delete has committed.
 */
export async function consumeOAuthAttempt(
  ctx: MutationCtx,
  args: { state: string; userId: Id<"users"> }
): Promise<ConsumeOAuthAttemptResult> {
  const stateHash = await hashToken(args.state)
  const row = await ctx.db
    .query("serviceOAuthAttempts")
    .withIndex("by_stateHash", (q) => q.eq("stateHash", stateHash))
    .unique()
  if (row === null) {
    return { status: "invalid" }
  }

  await ctx.db.delete("serviceOAuthAttempts", row._id)
  if (row.createdByUserId !== args.userId || row.expiresAt <= Date.now()) {
    return { status: "invalid" }
  }
  return {
    status: "ok",
    service: row.service,
    codeVerifier: row.codeVerifier,
  }
}

export async function purgeExpiredOAuthAttempts(
  ctx: MutationCtx,
  limit: number
): Promise<number> {
  const expired = await ctx.db
    .query("serviceOAuthAttempts")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
    .take(limit)
  for (const attempt of expired) {
    await ctx.db.delete("serviceOAuthAttempts", attempt._id)
  }
  return expired.length
}
