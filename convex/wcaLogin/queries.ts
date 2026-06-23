import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { findActiveInviteWithCompetition } from "@/convex/competitions/invites/model"
import {
  buildWcaAuthorizeUrl,
  isWcaLoginConfigured,
} from "@/convex/wcaLogin/wcaLogin"

export const wcaLoginConfigured = query({
  args: {},
  handler: () => isWcaLoginConfigured(),
})

export const wcaSignInUrl = query({
  args: {
    flow: v.union(v.literal("organiser"), v.literal("staff")),
  },
  returns: v.union(v.string(), v.null()),
  handler: (_ctx, args) => buildWcaAuthorizeUrl("", args.flow),
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
    const authorizeUrl = buildWcaAuthorizeUrl(args.token.trim(), "organiser")
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
