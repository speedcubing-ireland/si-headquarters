import { ConvexError, type Infer } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { normalizeEmail } from "@/convex/plugins/sponsor/sanitize"
import type { sponsorContactPermissions } from "./validators"

type SponsorCtx = QueryCtx | MutationCtx

export type SponsorContactPermissions = Infer<typeof sponsorContactPermissions>

export function contactPermissions(
  contact: Doc<"sponsorContacts">
): SponsorContactPermissions {
  return {
    canBid: contact.canBid,
    portalAccess: contact.portalAccess,
    receivesCc: contact.receivesCc,
  }
}

export function toSponsorContactForUI(contact: Doc<"sponsorContacts">) {
  return {
    id: contact._id,
    sponsorId: contact.sponsorId,
    name: contact.name,
    email: contact.email,
    active: contact.active,
    isPrimary: contact.isPrimary,
    receivesCc: contact.receivesCc,
    portalAccess: contact.portalAccess,
    canBid: contact.canBid,
    hasAuthAccount: contact.authUserId !== undefined,
    lastAccessEmailSentAt: contact.lastAccessEmailSentAt,
  }
}

export async function listContactsForSponsor(
  ctx: SponsorCtx,
  sponsorId: Id<"sponsors">
): Promise<Doc<"sponsorContacts">[]> {
  return await ctx.db
    .query("sponsorContacts")
    .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
    .collect()
}

export async function findContactByAuthUserId(
  ctx: SponsorCtx,
  authUserId: string
): Promise<Doc<"sponsorContacts"> | null> {
  return await ctx.db
    .query("sponsorContacts")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .unique()
}

export async function findContactByNormalizedEmail(
  ctx: SponsorCtx,
  emailNormalized: string
): Promise<Doc<"sponsorContacts"> | null> {
  return await ctx.db
    .query("sponsorContacts")
    .withIndex("by_email_normalized", (q) =>
      q.eq("emailNormalized", emailNormalized)
    )
    .unique()
}

export async function getPrimaryContact(
  ctx: SponsorCtx,
  sponsorId: Id<"sponsors">
): Promise<Doc<"sponsorContacts"> | null> {
  const contacts = await listContactsForSponsor(ctx, sponsorId)
  return contacts.find((contact) => contact.isPrimary) ?? null
}

export async function listActiveContactsForSponsor(
  ctx: SponsorCtx,
  sponsorId: Id<"sponsors">
): Promise<Doc<"sponsorContacts">[]> {
  const contacts = await listContactsForSponsor(ctx, sponsorId)
  return contacts.filter((contact) => contact.active)
}

export async function assertContactEmailAvailable(
  ctx: SponsorCtx,
  emailNormalized: string,
  options: {
    excludeContactId?: Id<"sponsorContacts">
    excludeSponsorId?: Id<"sponsors">
  } = {}
): Promise<void> {
  const existing = await findContactByNormalizedEmail(ctx, emailNormalized)
  if (existing && existing._id !== options.excludeContactId) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "A sponsor contact already uses this email.",
    })
  }
  const existingSponsor = await ctx.db
    .query("sponsors")
    .withIndex("by_email_normalized", (q) =>
      q.eq("emailNormalized", emailNormalized)
    )
    .unique()
  if (existingSponsor && existingSponsor._id !== options.excludeSponsorId) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "A sponsor already uses this email.",
    })
  }
}

export async function insertPrimaryContact(
  ctx: MutationCtx,
  input: {
    sponsor: Doc<"sponsors">
    actorId: Id<"users">
    now?: number
  }
): Promise<Id<"sponsorContacts">> {
  const now = input.now ?? Date.now()
  const { sponsor, actorId } = input
  return await ctx.db.insert("sponsorContacts", {
    sponsorId: sponsor._id,
    name: sponsor.name,
    email: sponsor.emailNormalized,
    emailNormalized: sponsor.emailNormalized,
    authUserId: sponsor.authUserId,
    active: true,
    isPrimary: true,
    receivesCc: false,
    portalAccess: true,
    canBid: true,
    lastAccessEmailSentAt: sponsor.lastAccessEmailSentAt,
    createdById: actorId,
    updatedById: actorId,
    updatedAt: now,
  })
}

export async function ensurePrimaryContactForSponsor(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  actorId: Id<"users">
): Promise<Doc<"sponsorContacts">> {
  const existing = await getPrimaryContact(ctx, sponsor._id)
  if (existing) return existing
  const contactId = await insertPrimaryContact(ctx, { sponsor, actorId })
  const contact = await ctx.db.get("sponsorContacts", contactId)
  if (!contact) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Failed to create primary sponsor contact.",
    })
  }
  return contact
}

export async function syncSponsorPrimaryEmailFromContact(
  ctx: MutationCtx,
  input: {
    sponsorId: Id<"sponsors">
    contact: Doc<"sponsorContacts">
    actorId: Id<"users">
  }
): Promise<void> {
  if (!input.contact.isPrimary) return
  const now = Date.now()
  await ctx.db.patch("sponsors", input.sponsorId, {
    name: input.contact.name,
    email: input.contact.emailNormalized,
    emailNormalized: input.contact.emailNormalized,
    authUserId: input.contact.authUserId,
    updatedById: input.actorId,
    updatedAt: now,
  })
}

export async function promoteSponsorContactToPrimary(
  ctx: MutationCtx,
  input: {
    sponsor: Doc<"sponsors">
    contact: Doc<"sponsorContacts">
    actorId: Id<"users">
    now?: number
  }
): Promise<Doc<"sponsorContacts">> {
  const { sponsor, contact, actorId } = input
  if (contact.sponsorId !== sponsor._id) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Sponsor contact not found.",
    })
  }
  if (!contact.active) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Cannot promote an archived contact to primary.",
    })
  }

  const now = input.now ?? Date.now()
  const contacts = await listContactsForSponsor(ctx, sponsor._id)
  await Promise.all(
    contacts
      .filter((row) => row.isPrimary && row._id !== contact._id)
      .map((row) =>
        ctx.db.patch("sponsorContacts", row._id, {
          isPrimary: false,
          updatedById: actorId,
          updatedAt: now,
        })
      )
  )
  await ctx.db.patch("sponsorContacts", contact._id, {
    isPrimary: true,
    receivesCc: false,
    updatedById: actorId,
    updatedAt: now,
  })
  const refreshed = await ctx.db.get("sponsorContacts", contact._id)
  if (!refreshed) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Sponsor contact not found.",
    })
  }
  await syncSponsorPrimaryEmailFromContact(ctx, {
    sponsorId: sponsor._id,
    contact: refreshed,
    actorId,
  })
  return refreshed
}

export async function syncPrimaryContactFromSponsor(
  ctx: MutationCtx,
  input: {
    sponsor: Doc<"sponsors">
    actorId: Id<"users">
    name: string
    emailNormalized: string
    now?: number
  }
): Promise<Doc<"sponsorContacts">> {
  const now = input.now ?? Date.now()
  const contact = await ensurePrimaryContactForSponsor(
    ctx,
    input.sponsor,
    input.actorId
  )
  await ctx.db.patch("sponsorContacts", contact._id, {
    name: input.name,
    email: input.emailNormalized,
    emailNormalized: input.emailNormalized,
    updatedById: input.actorId,
    updatedAt: now,
  })
  const refreshed = await ctx.db.get("sponsorContacts", contact._id)
  if (!refreshed) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Sponsor contact not found.",
    })
  }
  return refreshed
}

export async function resolvePortalAuthUserId(
  ctx: SponsorCtx,
  sponsor: Doc<"sponsors">
): Promise<string | undefined> {
  const primary = await getPrimaryContact(ctx, sponsor._id)
  return primary?.authUserId ?? sponsor.authUserId
}

export async function requireImpersonatableSponsorContact(
  ctx: SponsorCtx,
  args: {
    sponsorId: Id<"sponsors">
    contactId?: Id<"sponsorContacts">
  }
): Promise<{ sponsor: Doc<"sponsors">; contact: Doc<"sponsorContacts"> }> {
  const sponsor = await ctx.db.get("sponsors", args.sponsorId)
  if (sponsor?.active !== true) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Active sponsor not found.",
    })
  }

  const contact =
    args.contactId !== undefined
      ? await ctx.db.get("sponsorContacts", args.contactId)
      : await getPrimaryContact(ctx, sponsor._id)

  if (contact?.sponsorId !== sponsor._id) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Sponsor contact not found.",
    })
  }
  if (!contact.active) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Cannot impersonate an archived sponsor contact.",
    })
  }
  if (!contact.portalAccess) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "This contact does not have sponsor portal access.",
    })
  }
  if (contact.authUserId === undefined) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Sponsor contact does not have a portal auth account yet.",
    })
  }

  return { sponsor, contact }
}

export async function listCcEmailsForSponsor(
  ctx: SponsorCtx,
  sponsorId: Id<"sponsors">
): Promise<string[]> {
  const contacts = await listActiveContactsForSponsor(ctx, sponsorId)
  const ccEmails = contacts
    .filter((contact) => contact.receivesCc && !contact.isPrimary)
    .map((contact) => normalizeEmail(contact.email))
    .filter((email) => email.length > 0)
  return [...new Set(ccEmails)]
}

export async function buildAuctionEmailRecipient(
  ctx: SponsorCtx,
  sponsor: Doc<"sponsors">
): Promise<{
  sponsorId: Id<"sponsors">
  email: string
  name: string
  cc?: string[]
}> {
  const primary = await getPrimaryContact(ctx, sponsor._id)
  const activePrimary = primary?.active === true ? primary : null
  const cc = activePrimary ? await listCcEmailsForSponsor(ctx, sponsor._id) : []
  return {
    sponsorId: sponsor._id,
    email: activePrimary?.email ?? sponsor.email,
    name: activePrimary?.name ?? sponsor.name,
    ...(cc.length > 0 ? { cc } : {}),
  }
}
