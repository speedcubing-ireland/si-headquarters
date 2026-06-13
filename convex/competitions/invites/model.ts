import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { hashToken } from "@/convex/tokens"

type DbCtx = QueryCtx | MutationCtx

const MIN_TOKEN_LENGTH = 32

export function isInviteActive(
  invite: Doc<"competitionOrganiserInvites">,
  now: number
): boolean {
  return invite.revokedAt === undefined && invite.expiresAt > now
}

export async function findActiveInviteWithCompetition(
  ctx: DbCtx,
  token: string
): Promise<{
  invite: Doc<"competitionOrganiserInvites">
  competition: Doc<"competitions">
} | null> {
  const trimmed = token.trim()
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return null
  }
  const tokenHash = await hashToken(trimmed)
  const invite = await ctx.db
    .query("competitionOrganiserInvites")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique()
  if (invite === null || !isInviteActive(invite, Date.now())) {
    return null
  }
  const competition = await ctx.db.get("competitions", invite.competitionId)
  if (competition === null) {
    return null
  }
  return { invite, competition }
}
