import { getAuthSessionId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import {
  findSponsorSessionByToken,
  getUserName,
  normalizeImpersonationSessionId,
  normalizeUserId,
} from "@/convex/impersonation/model"

export const currentUserImpersonation = query({
  args: {},
  returns: v.union(
    v.object({
      targetType: v.literal("user"),
      actorUserId: v.id("users"),
      actorName: v.string(),
      expiresAt: v.number(),
      reason: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const sessionId = await getAuthSessionId(ctx)
    if (sessionId === null) return null
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
    return {
      targetType: "user" as const,
      actorUserId: session.impersonatedByUserId,
      actorName: await getUserName(ctx, session.impersonatedByUserId),
      expiresAt: session.impersonationExpiresAt,
      reason: ticket.reason,
    }
  },
})

export const currentSponsorImpersonation = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.object({
      targetType: v.literal("sponsor"),
      actorUserId: v.id("users"),
      actorName: v.string(),
      expiresAt: v.number(),
      reason: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await findSponsorSessionByToken(ctx, args.sessionToken)
    if (
      session === null ||
      typeof session.impersonationSessionId !== "string" ||
      typeof session.impersonatedByUserId !== "string" ||
      typeof session.impersonationExpiresAt !== "number" ||
      session.impersonationExpiresAt <= Date.now()
    ) {
      return null
    }
    const ticketId = normalizeImpersonationSessionId(
      ctx,
      session.impersonationSessionId
    )
    const actorUserId = normalizeUserId(ctx, session.impersonatedByUserId)
    if (ticketId === null || actorUserId === null) {
      return null
    }
    const ticket = await ctx.db.get("impersonationSessions", ticketId)
    if (ticket?.target.type !== "sponsor") {
      return null
    }
    return {
      targetType: "sponsor" as const,
      actorUserId,
      actorName: await getUserName(ctx, actorUserId),
      expiresAt: session.impersonationExpiresAt,
      reason: ticket.reason,
    }
  },
})
