import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { requireFreshTicket } from "@/convex/impersonation/model"

export const redeemUserTokenForAuth = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      sessionId: v.id("authSessions"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    try {
      const { ticket, now } = await requireFreshTicket(ctx, {
        token: args.token,
        targetType: "user",
      })
      if (ticket.target.type !== "user") {
        return null
      }
      const targetUser = await ctx.db.get("users", ticket.target.userId)
      if (targetUser === null || targetUser.disabled === true) {
        return null
      }
      const sessionId = await ctx.db.insert("authSessions", {
        userId: ticket.target.userId,
        expirationTime: ticket.sessionExpiresAt,
        impersonationSessionId: ticket._id,
        impersonatedByUserId: ticket.createdByUserId,
        impersonationExpiresAt: ticket.sessionExpiresAt,
      })
      await ctx.db.patch("impersonationSessions", ticket._id, {
        redeemedAt: now,
        redeemedSession: { kind: "hq", authSessionId: sessionId },
      })
      return {
        userId: ticket.target.userId,
        sessionId,
      }
    } catch {
      return null
    }
  },
})
