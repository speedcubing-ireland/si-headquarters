import { ConvexError, v } from "convex/values"
import { components } from "@/convex/_generated/api"
import { mutation, query } from "@/convex/_generated/server"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  impersonationBannerValidator,
  impersonationLinkResultValidator,
} from "@/convex/impersonation/validators"
import {
  buildImpersonationBanner,
  getUserName,
  impersonationLinkResult,
  insertImpersonationTicket,
  requireFreshTicket,
} from "@/convex/impersonation/model"
import { createToken } from "@/convex/tokens"
import { requireDirector } from "@/convex/permissions/principal"
import {
  findContactByAuthUserId,
  requireImpersonatableSponsorContact,
  resolvePortalAuthUserId,
} from "@/convex/plugins/sponsor/lib/contacts"
import { resolveSponsorPortalBaseUrl } from "@/convex/plugins/sponsor/siteUrls"

type SponsorImpersonationCtx = QueryCtx | MutationCtx
type JsonRecord = Record<string, string | number | boolean | null | undefined>

function isJsonRecord(value: object): value is JsonRecord {
  return !Array.isArray(value)
}

async function findSponsorSessionByToken(
  ctx: SponsorImpersonationCtx,
  sessionToken: string
) {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- adapter boundary
  const result: object | null = await ctx.runQuery(
    components.sponsorAuth.adapter.findOne,
    {
      model: "session",
      where: [{ field: "token", value: sessionToken }],
    }
  )
  return result !== null && isJsonRecord(result) ? result : null
}

async function findSponsorAuthUser(
  ctx: SponsorImpersonationCtx,
  authUserId: string
) {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- adapter boundary
  const result: object | null = await ctx.runQuery(
    components.sponsorAuth.adapter.findOne,
    {
      model: "user",
      where: [{ field: "_id", value: authUserId }],
    }
  )
  return result !== null && isJsonRecord(result) ? result : null
}

function impersonationSessionIdFromSponsorSession(
  ctx: SponsorImpersonationCtx,
  session: JsonRecord
) {
  const raw = session.impersonationSessionId
  return typeof raw === "string"
    ? ctx.db.normalizeId("impersonationSessions", raw)
    : null
}

function userIdFromSponsorSession(
  ctx: SponsorImpersonationCtx,
  session: JsonRecord
) {
  const raw = session.impersonatedByUserId
  return typeof raw === "string" ? ctx.db.normalizeId("users", raw) : null
}

export const createLink = mutation({
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

export const redeemToken = mutation({
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

export const end = mutation({
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

export const current = query({
  args: { sessionToken: v.string() },
  returns: v.union(impersonationBannerValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await findSponsorSessionByToken(ctx, args.sessionToken)
    if (
      session === null ||
      typeof session.impersonationExpiresAt !== "number" ||
      session.impersonationExpiresAt <= Date.now()
    ) {
      return null
    }
    const ticketId = impersonationSessionIdFromSponsorSession(ctx, session)
    const actorUserId = userIdFromSponsorSession(ctx, session)
    if (ticketId === null || actorUserId === null) {
      return null
    }
    const ticket = await ctx.db.get("impersonationSessions", ticketId)
    if (ticket?.target.type !== "sponsor") {
      return null
    }
    return await buildImpersonationBanner(ctx, {
      ticket,
      actorUserId,
      expiresAt: session.impersonationExpiresAt,
    })
  },
})
