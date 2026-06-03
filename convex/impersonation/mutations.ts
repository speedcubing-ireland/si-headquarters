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
  impersonationSessionIdFromSponsorSession,
  insertImpersonationTicket,
  requireFreshTicket,
} from "@/convex/impersonation/model"
import { requireDirector } from "@/convex/permissions/principal"
import {
  findContactByAuthUserId,
  requireImpersonatableSponsorContact,
  resolvePortalAuthUserId,
} from "@/convex/plugins/sponsor/lib/contacts"
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
    contactId: v.optional(v.id("sponsorContacts")),
    reason: v.string(),
  },
  returns: impersonationLinkResultValidator,
  handler: async (ctx, args) => {
    const actorId = await requireDirector(ctx)
    const { sponsor, contact } = await requireImpersonatableSponsorContact(
      ctx,
      {
        sponsorId: args.sponsorId,
        contactId: args.contactId,
      }
    )
    const sponsorAuthUserId = contact.authUserId
    if (sponsorAuthUserId === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sponsor contact does not have a portal auth account yet.",
      })
    }
    const authUser = await findSponsorAuthUser(ctx, sponsorAuthUserId)
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
          sponsorId: sponsor._id,
          sponsorAuthUserId,
          contactId: contact._id,
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
    if (sponsor?.active !== true) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Active sponsor not found.",
      })
    }

    let contactName = sponsor.name
    if (ticket.target.contactId !== undefined) {
      const contact = await ctx.db.get(
        "sponsorContacts",
        ticket.target.contactId
      )
      if (
        contact?.sponsorId !== sponsor._id ||
        contact.authUserId !== ticket.target.sponsorAuthUserId ||
        !contact.active ||
        !contact.portalAccess
      ) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Active sponsor contact not found.",
        })
      }
      contactName = contact.name
    } else {
      const linkedContact = await findContactByAuthUserId(
        ctx,
        ticket.target.sponsorAuthUserId
      )
      if (linkedContact !== null) {
        if (
          linkedContact.sponsorId !== sponsor._id ||
          !linkedContact.active ||
          !linkedContact.portalAccess
        ) {
          throw new ConvexError({
            code: "NOT_FOUND",
            message: "Active sponsor contact not found.",
          })
        }
        contactName = linkedContact.name
      } else if (
        (await resolvePortalAuthUserId(ctx, sponsor)) !==
        ticket.target.sponsorAuthUserId
      ) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Active sponsor not found.",
        })
      }
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
      sponsorName: contactName,
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
    const ticketId = impersonationSessionIdFromSponsorSession(ctx, session)
    if (ticketId !== null) {
      await ctx.db.patch("impersonationSessions", ticketId, {
        endedAt: Date.now(),
      })
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
