import type { QueryCtx } from "@/convex/_generated/server"
import { hashToken } from "@/convex/tokens"

const MIN_TOKEN_LENGTH = 32

export async function findActiveInviteWithCompetition(
  ctx: Pick<QueryCtx, "db">,
  token: string
) {
  const trimmed = token.trim()
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return null
  }
  const tokenHash = await hashToken(trimmed)
  const invite = await ctx.db
    .query("competitionOrganiserInvites")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique()
  if (
    invite === null ||
    invite.revokedAt !== undefined ||
    invite.expiresAt <= Date.now()
  ) {
    return null
  }
  const competition = await ctx.db.get("competitions", invite.competitionId)
  return competition === null ? null : { invite, competition }
}
