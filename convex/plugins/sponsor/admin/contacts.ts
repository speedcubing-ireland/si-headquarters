import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { mutation, query } from "@/convex/_generated/server"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import {
  ensureContactAuthAccount,
  revokeSponsorAuthSessions,
  syncSponsorAuthUserProfile,
} from "../auth/accounts"
import {
  assertContactEmailAvailable,
  listContactsForSponsor,
  getPrimaryContact,
  promoteSponsorContactToPrimary,
  syncSponsorPrimaryEmailFromContact,
  toSponsorContactForUI,
} from "../lib/contacts"
import { sponsorContactForUI } from "../lib/validators"
import { getSponsorshipEmailPayload } from "../emails/copy"
import { scheduleSponsorshipEmailBatch } from "../emails/send"
import {
  normalizeEmail,
  validateEmail,
} from "@/convex/plugins/sponsor/sanitize"
import { sponsorPortalLoginUrl } from "@/convex/plugins/sponsor/siteUrls"

async function requireActiveSponsor(
  ctx: Parameters<typeof requireSponsorPortalAdmin>[0],
  sponsorId: Id<"sponsors">
) {
  const sponsor = await ctx.db.get("sponsors", sponsorId)
  if (sponsor?.active !== true) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Active sponsor not found.",
    })
  }
  return sponsor
}

async function requireContact(
  ctx: Parameters<typeof requireSponsorPortalAdmin>[0],
  contactId: Id<"sponsorContacts">
) {
  const contact = await ctx.db.get("sponsorContacts", contactId)
  if (!contact) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Sponsor contact not found.",
    })
  }
  return contact
}

export const listBySponsor = query({
  args: { sponsorId: v.id("sponsors") },
  returns: v.array(sponsorContactForUI),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const contacts = await listContactsForSponsor(ctx, args.sponsorId)
    return contacts
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .map(toSponsorContactForUI)
  },
})

export const create = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    name: v.string(),
    email: v.string(),
    receivesCc: v.optional(v.boolean()),
    portalAccess: v.optional(v.boolean()),
    canBid: v.optional(v.boolean()),
    isPrimary: v.optional(v.boolean()),
  },
  returns: v.id("sponsorContacts"),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const sponsor = await requireActiveSponsor(ctx, args.sponsorId)
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
        message: "Contact name is required.",
      })
    }
    await assertContactEmailAvailable(ctx, emailNormalized)

    const now = Date.now()
    const makePrimary = args.isPrimary === true
    const existingPrimary = await getPrimaryContact(ctx, sponsor._id)
    const shouldBePrimary = makePrimary || existingPrimary === null

    const portalAccess = args.portalAccess ?? false
    const canBid = args.canBid ?? false
    const receivesCc = shouldBePrimary ? false : (args.receivesCc ?? false)

    const contactId = await ctx.db.insert("sponsorContacts", {
      sponsorId: sponsor._id,
      name,
      email: emailNormalized,
      emailNormalized,
      active: true,
      isPrimary: false,
      receivesCc,
      portalAccess,
      canBid: shouldBePrimary ? (args.canBid ?? true) : canBid,
      createdById: actorId,
      updatedById: actorId,
      updatedAt: now,
    })

    const contact = await ctx.db.get("sponsorContacts", contactId)
    if (!contact) {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Failed to create sponsor contact.",
      })
    }

    const contactForAuth = shouldBePrimary
      ? await promoteSponsorContactToPrimary(ctx, {
          sponsor,
          contact,
          actorId,
          now,
        })
      : contact

    if (portalAccess) {
      await ensureContactAuthAccount(ctx, {
        contact: contactForAuth,
        sponsor,
        updatedById: actorId,
      })
    }

    return contactId
  },
})

export const update = mutation({
  args: {
    contactId: v.id("sponsorContacts"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    receivesCc: v.optional(v.boolean()),
    portalAccess: v.optional(v.boolean()),
    canBid: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    isPrimary: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const contact = await requireContact(ctx, args.contactId)
    const sponsor = await ctx.db.get("sponsors", contact.sponsorId)
    if (!sponsor) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sponsor not found.",
      })
    }

    const now = Date.now()
    const patch: Partial<Doc<"sponsorContacts">> = {
      updatedById: actorId,
      updatedAt: now,
    }

    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Contact name cannot be empty.",
        })
      }
      patch.name = name
    }

    if (args.email !== undefined) {
      const emailNormalized = normalizeEmail(args.email)
      if (!emailNormalized || !validateEmail(emailNormalized)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "A valid email address is required.",
        })
      }
      await assertContactEmailAvailable(ctx, emailNormalized, {
        excludeContactId: contact._id,
        excludeSponsorId:
          contact.isPrimary || args.isPrimary === true
            ? contact.sponsorId
            : undefined,
      })
      patch.email = emailNormalized
      patch.emailNormalized = emailNormalized
    }

    if (args.receivesCc !== undefined && !contact.isPrimary) {
      patch.receivesCc = args.receivesCc
    }
    if (args.portalAccess !== undefined) patch.portalAccess = args.portalAccess
    if (args.canBid !== undefined) patch.canBid = args.canBid
    if (args.active !== undefined) patch.active = args.active

    if (args.isPrimary === true) patch.receivesCc = false

    const nextPortalAccess = args.portalAccess ?? contact.portalAccess
    const revokesPortalAccess =
      args.active === false ||
      (args.portalAccess === false && contact.portalAccess)
    if (revokesPortalAccess && contact.authUserId !== undefined) {
      await revokeSponsorAuthSessions(ctx, contact.authUserId)
    }
    if (args.active === false) {
      if (contact.isPrimary) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Cannot archive the primary sponsor contact.",
        })
      }
      patch.portalAccess = false
    }

    await ctx.db.patch("sponsorContacts", contact._id, patch)
    const patchedContact = await ctx.db.get("sponsorContacts", contact._id)
    if (!patchedContact) return null
    const refreshed =
      args.isPrimary === true
        ? await promoteSponsorContactToPrimary(ctx, {
            sponsor,
            contact: patchedContact,
            actorId,
            now,
          })
        : patchedContact

    const ensuredAuth =
      nextPortalAccess && refreshed.active
        ? await ensureContactAuthAccount(ctx, {
            contact: refreshed,
            sponsor,
            updatedById: actorId,
          })
        : null
    const authUserId = ensuredAuth?.authUserId ?? refreshed.authUserId

    if (refreshed.isPrimary) {
      await syncSponsorPrimaryEmailFromContact(ctx, {
        sponsorId: sponsor._id,
        contact:
          ensuredAuth === null
            ? refreshed
            : { ...refreshed, authUserId: ensuredAuth.authUserId },
        actorId,
      })
    }

    if (authUserId !== undefined) {
      await syncSponsorAuthUserProfile(ctx, {
        authUserId,
        name: refreshed.name,
        email: refreshed.emailNormalized,
        avatarUrl: sponsor.avatarUrl,
      })
    }

    return null
  },
})

export const sendAccessEmail = mutation({
  args: { contactId: v.id("sponsorContacts") },
  returns: v.object({
    sentTo: v.string(),
    hasAuthAccount: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const contact = await requireContact(ctx, args.contactId)
    const sponsor = await requireActiveSponsor(ctx, contact.sponsorId)
    if (!contact.active || !contact.portalAccess) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Contact must be active with portal access enabled.",
      })
    }

    await ensureContactAuthAccount(ctx, {
      contact,
      sponsor,
      updatedById: actorId,
    })

    const now = Date.now()
    const portalUrl = sponsorPortalLoginUrl()
    const { subject, message } = getSponsorshipEmailPayload("invite", {
      sponsorName: contact.name,
    })
    await scheduleSponsorshipEmailBatch(ctx, {
      emailType: "invite",
      subject,
      message,
      context: { portalUrl },
      recipients: [
        {
          sponsorId: sponsor._id,
          email: contact.email,
          name: contact.name,
        },
      ],
    })

    await ctx.db.patch("sponsorContacts", contact._id, {
      lastAccessEmailSentAt: now,
      updatedById: actorId,
      updatedAt: now,
    })

    return {
      sentTo: contact.email,
      hasAuthAccount: true,
    }
  },
})

export const revokeSessions = mutation({
  args: { contactId: v.id("sponsorContacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const contact = await requireContact(ctx, args.contactId)
    if (contact.authUserId === undefined) return null
    await revokeSponsorAuthSessions(ctx, contact.authUserId)
    return null
  },
})

export const setPrimary = mutation({
  args: { contactId: v.id("sponsorContacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const contact = await requireContact(ctx, args.contactId)
    const sponsor = await requireActiveSponsor(ctx, contact.sponsorId)
    await promoteSponsorContactToPrimary(ctx, { sponsor, contact, actorId })
    return null
  },
})
