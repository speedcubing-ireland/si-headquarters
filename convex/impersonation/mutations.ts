import { ConvexError, v } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import { impersonationLinkResultValidator } from "@/convex/impersonation/validators"
import {
  impersonationLinkResult,
  insertImpersonationTicket,
} from "@/convex/impersonation/model"
import { requireDirector } from "@/convex/permissions/principal"
import { resolveHqSiteBaseUrl } from "@/convex/urls"

export const createUserLink = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: impersonationLinkResultValidator,
  handler: async (ctx, args) => {
    const actorId = await requireDirector(ctx)
    if (actorId === args.userId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "You cannot impersonate yourself.",
      })
    }
    const targetUser = await ctx.db.get("users", args.userId)
    if (targetUser === null || targetUser.disabled === true) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Active user not found.",
      })
    }

    const { token, ticketExpiresAt, sessionExpiresAt } =
      await insertImpersonationTicket(ctx, {
        actorId,
        reason: args.reason,
        target: { type: "user", userId: args.userId },
      })

    return impersonationLinkResult(
      resolveHqSiteBaseUrl(),
      "/impersonate/user",
      token,
      ticketExpiresAt,
      sessionExpiresAt
    )
  },
})
