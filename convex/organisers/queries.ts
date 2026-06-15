import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { findActiveInviteWithCompetition } from "@/convex/competitions/invites/model"
import {
  buildWcaAuthorizeUrl,
  isWcaLoginConfigured,
} from "@/convex/organisers/wcaLogin"

export const wcaLoginConfigured = query({
  args: {},
  handler: () => isWcaLoginConfigured(),
})

export const wcaSignInUrl = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: () => buildWcaAuthorizeUrl(""),
})

export const inviteContext = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      competitionName: v.string(),
      expiresAt: v.number(),
      authorizeUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const result = await findActiveInviteWithCompetition(ctx, args.token)
    if (result === null) {
      return null
    }
    const authorizeUrl = buildWcaAuthorizeUrl(args.token.trim())
    if (authorizeUrl === null) {
      return null
    }
    return {
      competitionName: result.competition.name,
      expiresAt: result.invite.expiresAt,
      authorizeUrl,
    }
  },
})
