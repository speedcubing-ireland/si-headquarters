import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { findActiveInviteWithCompetition } from "@/convex/competitions/invites/model"
import { buildWcaAuthorizeUrl } from "@/convex/organisers/wcaLogin"

// Returns null when WCA organiser login is not configured, hiding the
// sign-in button.
export const wcaSignInUrl = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: () => buildWcaAuthorizeUrl(""),
})

// Public, token-gated: powers the unauthenticated invite landing page. The
// invite token is round-tripped through the OAuth state parameter so it can
// be redeemed after WCA redirects back.
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
