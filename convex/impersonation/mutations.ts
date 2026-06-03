import { ConvexError, v } from "convex/values"
import { components } from "@/convex/_generated/api"
import { mutation } from "@/convex/_generated/server"
import { impersonationLinkResultValidator } from "@/convex/impersonation/validators"
import {
  createToken,
  findSponsorAuthUser,
  findSponsorSessionByToken,
  getUserName,
  impersonationLinkResult,
  insertImpersonationTicket,
  normalizeImpersonationSessionId,
  requireFreshTicket,
} from "@/convex/impersonation/model"
import { requireDirector } from "@/convex/permissions/principal"
import {
  resolveHqSiteBaseUrl,
  resolveSponsorPortalBaseUrl,
} from "@/convex/plugins/sponsor/siteUrls"

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

export const createSponsorLink = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    reason: v.string(),
  },
  returns: impersonationLinkResultValidator,
  handler: async (ctx, args) => {
    const actorId = await requireDirector(ctx)
    const sponsor = await ctx.db.get("sponsors", args.sponsorId)
    if (sponsor?.active !== true || sponsor.authUserId === undefined) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Active sponsor with portal access not found.",
      })
    }
    const authUser = await findSponsorAuthUser(ctx, sponsor.authUserId)
    if (authUser === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sponsor auth account not found.",
      })
    }

    const { token, ticketExpiresAt, sessionExpiresAt } =
      await insertImpersonationTicket(ctx, {
        actorId,
        reason: args.reason,
        target: {
          type: "sponsor",
          sponsorId: args.sponsorId,
          sponsorAuthUserId: sponsor.authUserId,
        },
      })

    return impersonationLinkResult(
      resolveSponsorPortalBaseUrl(),
      "/sponsor/impersonate",
      token,
      ticketExpiresAt,
      sessionExpiresAt
    )
  },
})

export const redeemSponsorToken = mutation({
  args: { token: v.string() },
  returns: v.object({
    sessionToken: v.string(),
    sessionExpiresAt: v.number(),
    sponsorName: v.string(),
    actorName: v.string(),
  }),
  handler: async (ctx, args) => {
    const { ticket, now } = await requireFreshTicket(ctx, {
      token: args.token,
      targetType: "sponsor",
    })
    if (ticket.target.type !== "sponsor") {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Impersonation link is invalid or expired.",
      })
    }
    const sponsor = await ctx.db.get("sponsors", ticket.target.sponsorId)
    if (
      sponsor?.active !== true ||
      sponsor.authUserId !== ticket.target.sponsorAuthUserId
    ) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Active sponsor not found.",
      })
    }
    const authUser = await findSponsorAuthUser(
      ctx,
      ticket.target.sponsorAuthUserId
    )
    if (authUser === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sponsor auth account not found.",
      })
    }

    const sessionToken = createToken()
    await ctx.runMutation(components.sponsorAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          token: sessionToken,
          userId: ticket.target.sponsorAuthUserId,
          expiresAt: ticket.sessionExpiresAt,
          createdAt: now,
          updatedAt: now,
          impersonationSessionId: ticket._id,
          impersonatedByUserId: ticket.createdByUserId,
          impersonationExpiresAt: ticket.sessionExpiresAt,
        },
      },
    })
    await ctx.db.patch("impersonationSessions", ticket._id, {
      redeemedAt: now,
      redeemedSession: { kind: "sponsor", sponsorSessionToken: sessionToken },
    })

    return {
      sessionToken,
      sessionExpiresAt: ticket.sessionExpiresAt,
      sponsorName: sponsor.name,
      actorName: await getUserName(ctx, ticket.createdByUserId),
    }
  },
})

export const endSponsorImpersonation = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await findSponsorSessionByToken(ctx, args.sessionToken)
    if (session === null || typeof session._id !== "string") {
      return null
    }
    if (typeof session.impersonationSessionId === "string") {
      const ticketId = normalizeImpersonationSessionId(
        ctx,
        session.impersonationSessionId
      )
      if (ticketId !== null) {
        await ctx.db.patch("impersonationSessions", ticketId, {
          endedAt: Date.now(),
        })
      }
    }
    await ctx.runMutation(components.sponsorAuth.adapter.deleteOne, {
      input: {
        model: "session",
        where: [{ field: "_id", value: session._id }],
      },
    })
    return null
  },
})
