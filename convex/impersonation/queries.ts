import { getAuthSessionId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { buildImpersonationBanner } from "@/convex/impersonation/model"
import { impersonationBannerValidator } from "@/convex/impersonation/validators"

export const currentUserImpersonation = query({
  args: {},
  returns: v.union(impersonationBannerValidator, v.null()),
  handler: async (ctx) => {
    const sessionId = await getAuthSessionId(ctx)
    if (sessionId === null) {
      return null
    }
    const session = await ctx.db.get("authSessions", sessionId)
    if (
      session?.impersonationSessionId === undefined ||
      session.impersonatedByUserId === undefined ||
      session.impersonationExpiresAt === undefined ||
      session.impersonationExpiresAt <= Date.now()
    ) {
      return null
    }
    const ticket = await ctx.db.get(
      "impersonationSessions",
      session.impersonationSessionId
    )
    if (ticket?.target.type !== "user") {
      return null
    }
    return await buildImpersonationBanner(ctx, {
      ticket,
      actorUserId: session.impersonatedByUserId,
      expiresAt: session.impersonationExpiresAt,
    })
  },
})
