import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { redeemUserTicketForAuth } from "@/convex/impersonation/model"

export const redeemUserTokenForAuth = internalMutation({
  args: {
    token: v.string(),
    consumptionNonce: v.string(),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      sessionId: v.id("authSessions"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    try {
      return await redeemUserTicketForAuth(ctx, args)
    } catch {
      return null
    }
  },
})
