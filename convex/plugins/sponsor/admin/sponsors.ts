import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { mutation, query, type MutationCtx } from "@/convex/_generated/server"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { resolveAuctionBidState } from "../lib/auctionState"
import {
  normalizeEmail,
  validateEmail,
} from "@/convex/plugins/sponsor/sanitize"
import { sponsorPortalLoginUrl } from "@/convex/plugins/sponsor/siteUrls"
import { sponsorForUI } from "@/convex/plugins/sponsor/lib/validators"
import { getSponsorshipEmailPayload } from "../emails/copy"
import { scheduleSponsorshipEmailBatch } from "../emails/send"
import {
  ensureContactAuthAccount,
  revokeSponsorAuthSessions,
  syncSponsorAuthUserProfile,
} from "../auth/accounts"
import {
  assertContactEmailAvailable,
  ensurePrimaryContactForSponsor,
  getPrimaryContact,
  insertPrimaryContact,
  listContactsForSponsor,
  syncPrimaryContactFromSponsor,
} from "../lib/contacts"

const OPEN_AUCTION_STATES = ["draft", "scheduled", "active"] as const

function normalizeOptionalUrl(
  value: string | null | undefined
): string | undefined {
  if (value === null) {
    return undefined
  }
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined
  }
  return trimmed
}

async function collectSponsorAffectedOpenAuctions(
  ctx: MutationCtx,
  sponsorId: Id<"sponsors">
): Promise<
  {
    auction: Doc<"sponsorshipAuctions">
    validSponsorIntents: Doc<"sponsorshipBidIntents">[]
  }[]
> {
  const validSponsorIntents = await ctx.db
    .query("sponsorshipBidIntents")
    .withIndex("by_sponsor_and_is_valid", (q) =>
      q.eq("sponsorId", sponsorId).eq("isValid", true)
    )
    .collect()
  const validIntentsByAuctionId = new Map<
    Id<"sponsorshipAuctions">,
    Doc<"sponsorshipBidIntents">[]
  >()
  for (const intent of validSponsorIntents) {
    const existing = validIntentsByAuctionId.get(intent.auctionId) ?? []
    existing.push(intent)
    validIntentsByAuctionId.set(intent.auctionId, existing)
  }

  const [intentAuctions, leaderAuctionGroups] = await Promise.all([
    Promise.all(
      [...validIntentsByAuctionId.keys()].map((auctionId) =>
        ctx.db.get("sponsorshipAuctions", auctionId)
      )
    ),
    Promise.all(
      OPEN_AUCTION_STATES.map((state) =>
        ctx.db
          .query("sponsorshipAuctions")
          .withIndex("by_currentLeaderSponsorId_and_state", (q) =>
            q.eq("currentLeaderSponsorId", sponsorId).eq("state", state)
          )
          .collect()
      )
    ),
  ])

  const auctionsById = new Map<
    Id<"sponsorshipAuctions">,
    Doc<"sponsorshipAuctions">
  >()
  for (const auction of intentAuctions) {
    if (auction === null || auction.state === "closed") continue
    auctionsById.set(auction._id, auction)
  }
  for (const auction of leaderAuctionGroups.flat()) {
    auctionsById.set(auction._id, auction)
  }

  return [...auctionsById.values()].map((auction) => ({
    auction,
    validSponsorIntents: validIntentsByAuctionId.get(auction._id) ?? [],
  }))
}

async function archiveSponsorFromOpenAuctions(
  ctx: MutationCtx,
  args: {
    actorId: Id<"users">
    sponsorId: Id<"sponsors">
  }
): Promise<void> {
  const affectedAuctions = await collectSponsorAffectedOpenAuctions(
    ctx,
    args.sponsorId
  )
  for (const { auction, validSponsorIntents } of affectedAuctions) {
    await Promise.all(
      validSponsorIntents.map((intent) =>
        ctx.db.patch("sponsorshipBidIntents", intent._id, {
          isValid: false,
        })
      )
    )

    const allAuctionIntents = await ctx.db
      .query("sponsorshipBidIntents")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect()
    const validIntents = allAuctionIntents.filter(
      (intent) => intent.isValid && intent.sponsorId !== args.sponsorId
    )
    await ctx.db.patch("sponsorshipAuctions", auction._id, {
      ...resolveAuctionBidState({
        auction,
        validIntents,
      }),
      updatedById: args.actorId,
      updatedAt: Date.now(),
    })
  }
}

async function revokeAllSponsorAuthSessions(
  ctx: MutationCtx,
  sponsor: { _id: Id<"sponsors">; authUserId?: string }
): Promise<void> {
  const contacts = await listContactsForSponsor(ctx, sponsor._id)
  const authUserIds = new Set<string>()
  for (const contact of contacts) {
    if (contact.authUserId !== undefined) authUserIds.add(contact.authUserId)
  }
  if (sponsor.authUserId !== undefined) authUserIds.add(sponsor.authUserId)
  await Promise.all(
    [...authUserIds].map((authUserId) =>
      revokeSponsorAuthSessions(ctx, authUserId)
    )
  )
}

export const list = query({
  args: {},
  returns: v.array(sponsorForUI),
  handler: async (ctx) => {
    await requireSponsorPortalAdmin(ctx)
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("by_name")
      .order("asc")
      .collect()
    return await Promise.all(
      sponsors.map(async (sponsor) => {
        const primary = await getPrimaryContact(ctx, sponsor._id)
        return {
          id: sponsor._id,
          name: sponsor.name,
          email: sponsor.email,
          avatarUrl: sponsor.avatarUrl,
          active: sponsor.active,
          hasAuthAccount:
            primary?.authUserId !== undefined ||
            sponsor.authUserId !== undefined,
          lastAccessEmailSentAt:
            primary?.lastAccessEmailSentAt ?? sponsor.lastAccessEmailSentAt,
        }
      })
    )
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.id("sponsors"),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const emailNormalized = normalizeEmail(args.email)
    if (!emailNormalized || !validateEmail(emailNormalized)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "A valid email address is required.",
      })
    }
    const name = args.name.trim()
    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sponsor name is required.",
      })
    }

    await assertContactEmailAvailable(ctx, emailNormalized)

    const now = Date.now()
    const sponsorId = await ctx.db.insert("sponsors", {
      name,
      email: emailNormalized,
      emailNormalized,
      avatarUrl: normalizeOptionalUrl(args.avatarUrl),
      active: true,
      createdById: actorId,
      updatedById: actorId,
      updatedAt: now,
    })
    const sponsor = await ctx.db.get("sponsors", sponsorId)
    if (sponsor) {
      await insertPrimaryContact(ctx, { sponsor, actorId, now })
    }
    return sponsorId
  },
})

export const update = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const sponsor = await ctx.db.get("sponsors", args.sponsorId)
    if (!sponsor) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sponsor not found.",
      })
    }

    const patch: Partial<typeof sponsor> = {
      updatedById: actorId,
      updatedAt: Date.now(),
    }
    if (sponsor.email !== sponsor.emailNormalized) {
      patch.email = sponsor.emailNormalized
      patch.emailNormalized = sponsor.emailNormalized
    }
    const nextName = args.name === undefined ? sponsor.name : args.name.trim()
    if (!nextName) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sponsor name cannot be empty.",
      })
    }
    if (args.name !== undefined) {
      patch.name = nextName
    }

    let nextEmail = sponsor.emailNormalized
    if (args.email !== undefined) {
      const emailNormalized = normalizeEmail(args.email.trim())
      if (!emailNormalized || !validateEmail(emailNormalized)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "A valid email address is required.",
        })
      }
      const primary = await getPrimaryContact(ctx, sponsor._id)
      await assertContactEmailAvailable(ctx, emailNormalized, {
        excludeContactId: primary?._id,
        excludeSponsorId: sponsor._id,
      })
      nextEmail = emailNormalized
      patch.email = nextEmail
      patch.emailNormalized = emailNormalized
    }

    const nextAvatarUrl =
      args.avatarUrl === undefined
        ? sponsor.avatarUrl
        : normalizeOptionalUrl(args.avatarUrl)
    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = nextAvatarUrl
    }

    if (args.active !== undefined) {
      patch.active = args.active
    }

    if (args.active === false && sponsor.active) {
      await archiveSponsorFromOpenAuctions(ctx, {
        sponsorId: sponsor._id,
        actorId,
      })
    }

    await ctx.db.patch("sponsors", sponsor._id, patch)
    const primary = await syncPrimaryContactFromSponsor(ctx, {
      sponsor,
      actorId,
      name: nextName,
      emailNormalized: nextEmail,
      now: patch.updatedAt,
    })

    const authUserId = primary.authUserId ?? sponsor.authUserId
    if (authUserId !== undefined) {
      await syncSponsorAuthUserProfile(ctx, {
        authUserId,
        name: nextName,
        email: nextEmail,
        avatarUrl: nextAvatarUrl,
      })
    }

    if (args.active === false && sponsor.active) {
      const contacts = await listContactsForSponsor(ctx, sponsor._id)
      const now = Date.now()
      for (const contact of contacts) {
        if (contact.active) {
          await ctx.db.patch("sponsorContacts", contact._id, {
            active: false,
            portalAccess: false,
            updatedById: actorId,
            updatedAt: now,
          })
        }
      }
      await revokeAllSponsorAuthSessions(ctx, sponsor)
    }
    return null
  },
})

export const sendAccessEmail = mutation({
  args: {
    sponsorId: v.id("sponsors"),
  },
  returns: v.object({
    sentTo: v.string(),
    hasAuthAccount: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const sponsor = await ctx.db.get("sponsors", args.sponsorId)
    if (sponsor?.active !== true) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Active sponsor not found.",
      })
    }

    const primary = await ensurePrimaryContactForSponsor(ctx, sponsor, actorId)
    if (!primary.active) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Primary sponsor contact is archived.",
      })
    }
    if (!primary.portalAccess) {
      await ctx.db.patch("sponsorContacts", primary._id, {
        portalAccess: true,
        updatedById: actorId,
        updatedAt: Date.now(),
      })
    }
    const refreshedPrimary =
      (await ctx.db.get("sponsorContacts", primary._id)) ?? primary

    await ensureContactAuthAccount(ctx, {
      contact: refreshedPrimary,
      sponsor,
      updatedById: actorId,
    })

    const now = Date.now()
    const portalUrl = sponsorPortalLoginUrl()
    const { subject, message } = getSponsorshipEmailPayload("invite", {
      sponsorName: refreshedPrimary.name,
    })
    await scheduleSponsorshipEmailBatch(ctx, {
      emailType: "invite",
      subject,
      message,
      context: {
        portalUrl,
      },
      recipients: [
        {
          sponsorId: sponsor._id,
          email: refreshedPrimary.email,
          name: refreshedPrimary.name,
        },
      ],
    })

    await ctx.db.patch("sponsorContacts", refreshedPrimary._id, {
      lastAccessEmailSentAt: now,
      updatedById: actorId,
      updatedAt: now,
    })
    await ctx.db.patch("sponsors", sponsor._id, {
      lastAccessEmailSentAt: now,
      updatedById: actorId,
      updatedAt: now,
    })

    return {
      sentTo: refreshedPrimary.email,
      hasAuthAccount: true,
    }
  },
})

export const revokeSessions = mutation({
  args: { sponsorId: v.id("sponsors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const sponsor = await ctx.db.get("sponsors", args.sponsorId)
    if (!sponsor) return null
    await revokeAllSponsorAuthSessions(ctx, sponsor)
    return null
  },
})
