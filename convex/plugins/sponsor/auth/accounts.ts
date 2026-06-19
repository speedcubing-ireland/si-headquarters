import { ConvexError } from "convex/values"
import { components } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  contactPermissions,
  ensurePrimaryContactForSponsor,
  findContactByAuthUserId,
  listContactsForSponsor,
  syncSponsorPrimaryEmailFromContact,
  type SponsorContactPermissions,
} from "@/convex/plugins/sponsor/lib/contacts"

export type { SponsorContactPermissions }

interface SponsorAuthUserDoc {
  _id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  createdAt: number
  updatedAt: number
}

interface SponsorAuthSessionDoc {
  _id: string
  token: string
  userId: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  ipAddress?: string | null
  userAgent?: string | null
}

type SponsorCtx = MutationCtx | QueryCtx

interface SponsorAuthFindOneWhereClause {
  field: string
  value: string | number
}

interface SponsorAuthFindOneExpiresWhereClause {
  field: string
  operator: "gt"
  value: number
}

interface SponsorAuthFindOneArgs {
  model: "user" | "session"
  where: (
    | SponsorAuthFindOneWhereClause
    | SponsorAuthFindOneExpiresWhereClause
  )[]
}

type JsonRecord = Record<string, string | number | boolean | null | undefined>

async function querySponsorAuthDocument(
  ctx: SponsorCtx,
  args: SponsorAuthFindOneArgs
): Promise<object | null> {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- adapter boundary
  const queryResult: object | null = await ctx.runQuery(
    components.sponsorAuth.adapter.findOne,
    args
  )
  if (typeof queryResult !== "object" || queryResult === null) {
    return null
  }
  return queryResult
}

function isJsonRecord(value: object): value is JsonRecord {
  return !Array.isArray(value)
}

function parseSponsorAuthUserDoc(value: object): SponsorAuthUserDoc | null {
  if (!isJsonRecord(value)) return null
  if (typeof value._id !== "string") return null
  if (typeof value.email !== "string") return null
  if (typeof value.name !== "string") return null
  if (typeof value.emailVerified !== "boolean") return null
  if (typeof value.createdAt !== "number") return null
  if (typeof value.updatedAt !== "number") return null
  if (
    value.image !== undefined &&
    value.image !== null &&
    typeof value.image !== "string"
  ) {
    return null
  }
  return {
    _id: value._id,
    email: value.email,
    name: value.name,
    image: typeof value.image === "string" ? value.image : null,
    emailVerified: value.emailVerified,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseSponsorAuthSessionDoc(
  value: object
): SponsorAuthSessionDoc | null {
  if (!isJsonRecord(value)) return null
  if (typeof value._id !== "string") return null
  if (typeof value.token !== "string") return null
  if (typeof value.userId !== "string") return null
  if (typeof value.expiresAt !== "number") return null
  if (typeof value.createdAt !== "number") return null
  if (typeof value.updatedAt !== "number") return null
  if (
    value.ipAddress !== undefined &&
    value.ipAddress !== null &&
    typeof value.ipAddress !== "string"
  ) {
    return null
  }
  if (
    value.userAgent !== undefined &&
    value.userAgent !== null &&
    typeof value.userAgent !== "string"
  ) {
    return null
  }
  return {
    _id: value._id,
    token: value.token,
    userId: value.userId,
    expiresAt: value.expiresAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ipAddress: typeof value.ipAddress === "string" ? value.ipAddress : null,
    userAgent: typeof value.userAgent === "string" ? value.userAgent : null,
  }
}

async function findSponsorByAuthUserId(
  ctx: SponsorCtx,
  authUserId: string
): Promise<Doc<"sponsors"> | null> {
  return await ctx.db
    .query("sponsors")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .unique()
}

export async function findSponsorAuthUserById(
  ctx: SponsorCtx,
  authUserId: string
): Promise<SponsorAuthUserDoc | null> {
  const result = await querySponsorAuthDocument(ctx, {
    model: "user",
    where: [{ field: "_id", value: authUserId }],
  })
  return result === null ? null : parseSponsorAuthUserDoc(result)
}

export async function findSponsorAuthUserByEmail(
  ctx: SponsorCtx,
  email: string
): Promise<SponsorAuthUserDoc | null> {
  const result = await querySponsorAuthDocument(ctx, {
    model: "user",
    where: [{ field: "email", value: email }],
  })
  return result === null ? null : parseSponsorAuthUserDoc(result)
}

async function findAuthConflictForContact(
  ctx: MutationCtx,
  authUserId: string,
  contactId: Id<"sponsorContacts">,
  sponsorId: Id<"sponsors">
): Promise<void> {
  const linkedContact = await findContactByAuthUserId(ctx, authUserId)
  if (linkedContact && linkedContact._id !== contactId) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message:
        "A sponsor auth account already exists for this email and is linked to another contact.",
    })
  }
  const linkedSponsor = await findSponsorByAuthUserId(ctx, authUserId)
  if (linkedSponsor) {
    if (linkedSponsor._id !== sponsorId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "A sponsor auth account already exists for this email and is linked to another sponsor.",
      })
    }
    const sponsorPrimary = await listContactsForSponsor(ctx, linkedSponsor._id)
    const primary = sponsorPrimary.find((row) => row.isPrimary)
    if (primary && primary._id !== contactId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "A sponsor auth account already exists for this email and is linked to another sponsor.",
      })
    }
  }
}

export async function ensureContactAuthAccount(
  ctx: MutationCtx,
  args: {
    contact: Doc<"sponsorContacts">
    sponsor: Doc<"sponsors">
    updatedById: Id<"users">
  }
): Promise<{ authUserId: string; created: boolean }> {
  const now = Date.now()
  const canonicalEmail = args.contact.emailNormalized
  const existingLinkedUser =
    args.contact.authUserId !== undefined
      ? await findSponsorAuthUserById(ctx, args.contact.authUserId)
      : null
  if (existingLinkedUser !== null) {
    await findAuthConflictForContact(
      ctx,
      existingLinkedUser._id,
      args.contact._id,
      args.sponsor._id
    )
    if (existingLinkedUser.email !== canonicalEmail) {
      await ctx.runMutation(components.sponsorAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: existingLinkedUser._id }],
          update: {
            email: canonicalEmail,
          },
        },
      })
    }
    await ctx.db.patch("sponsorContacts", args.contact._id, {
      authUserId: existingLinkedUser._id,
      updatedById: args.updatedById,
      updatedAt: now,
    })
    if (args.contact.isPrimary) {
      await syncSponsorPrimaryEmailFromContact(ctx, {
        sponsorId: args.sponsor._id,
        contact: {
          ...args.contact,
          authUserId: existingLinkedUser._id,
        },
        actorId: args.updatedById,
      })
    }
    return { authUserId: existingLinkedUser._id, created: false }
  }

  const existingByEmail = await findSponsorAuthUserByEmail(ctx, canonicalEmail)
  if (existingByEmail !== null) {
    await findAuthConflictForContact(
      ctx,
      existingByEmail._id,
      args.contact._id,
      args.sponsor._id
    )
    if (existingByEmail.email !== canonicalEmail) {
      await ctx.runMutation(components.sponsorAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: existingByEmail._id }],
          update: {
            email: canonicalEmail,
          },
        },
      })
    }
    await ctx.db.patch("sponsorContacts", args.contact._id, {
      authUserId: existingByEmail._id,
      updatedById: args.updatedById,
      updatedAt: now,
    })
    if (args.contact.isPrimary) {
      await syncSponsorPrimaryEmailFromContact(ctx, {
        sponsorId: args.sponsor._id,
        contact: { ...args.contact, authUserId: existingByEmail._id },
        actorId: args.updatedById,
      })
    }
    return { authUserId: existingByEmail._id, created: false }
  }

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- adapter boundary
  const newUser: object | null = await ctx.runMutation(
    components.sponsorAuth.adapter.create,
    {
      input: {
        model: "user",
        data: {
          email: canonicalEmail,
          name: args.contact.name,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        },
      },
    }
  )
  if (newUser === null || typeof newUser !== "object") {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Failed to create sponsor auth account.",
    })
  }
  const newUserDoc = parseSponsorAuthUserDoc(newUser)
  if (newUserDoc === null) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Failed to create sponsor auth account.",
    })
  }

  await ctx.db.patch("sponsorContacts", args.contact._id, {
    authUserId: newUserDoc._id,
    updatedById: args.updatedById,
    updatedAt: now,
  })
  if (args.contact.isPrimary) {
    await syncSponsorPrimaryEmailFromContact(ctx, {
      sponsorId: args.sponsor._id,
      contact: { ...args.contact, authUserId: newUserDoc._id },
      actorId: args.updatedById,
    })
  }
  return { authUserId: newUserDoc._id, created: true }
}

export async function ensureSponsorAuthAccount(
  ctx: MutationCtx,
  args: {
    sponsor: Doc<"sponsors">
    updatedById: Id<"users">
  }
): Promise<{ authUserId: string; created: boolean }> {
  const primary = await ensurePrimaryContactForSponsor(
    ctx,
    args.sponsor,
    args.updatedById
  )
  return await ensureContactAuthAccount(ctx, {
    contact: primary,
    sponsor: args.sponsor,
    updatedById: args.updatedById,
  })
}

export async function syncSponsorAuthUserProfile(
  ctx: MutationCtx,
  args: {
    authUserId: string
    name: string
    email: string
    avatarUrl?: string
  }
): Promise<void> {
  await ctx.runMutation(components.sponsorAuth.adapter.updateOne, {
    input: {
      model: "user",
      where: [{ field: "_id", value: args.authUserId }],
      update: {
        name: args.name,
        email: args.email,
        image: args.avatarUrl ?? null,
      },
    },
  })
}

export async function revokeSponsorAuthSessions(
  ctx: MutationCtx,
  authUserId: string
): Promise<void> {
  await ctx.runMutation(components.sponsorAuth.adapter.deleteMany, {
    input: {
      model: "session",
      where: [{ field: "userId", value: authUserId }],
    },
    paginationOpts: {
      cursor: null,
      numItems: 1000,
    },
  })
}

const LEGACY_PORTAL_PERMISSIONS: SponsorContactPermissions = {
  canBid: true,
  portalAccess: true,
  receivesCc: false,
}

export async function requireSponsorByAuthSessionToken(
  ctx: SponsorCtx,
  sessionToken: string
): Promise<{
  sponsor: Doc<"sponsors">
  contact: Doc<"sponsorContacts"> | null
  permissions: SponsorContactPermissions
  session: SponsorAuthSessionDoc
  user: SponsorAuthUserDoc
}> {
  const rawSession = await querySponsorAuthDocument(ctx, {
    model: "session",
    where: [
      { field: "token", value: sessionToken },
      { field: "expiresAt", operator: "gt", value: Date.now() },
    ],
  })
  if (rawSession === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sponsor session expired. Please sign in again.",
    })
  }
  const session = parseSponsorAuthSessionDoc(rawSession)
  if (session === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sponsor session expired. Please sign in again.",
    })
  }

  const user = await findSponsorAuthUserById(ctx, session.userId)
  if (user === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sponsor account was not found.",
    })
  }

  const contact = await findContactByAuthUserId(ctx, user._id)
  let sponsor: Doc<"sponsors"> | null = null
  if (contact) {
    sponsor = await ctx.db.get("sponsors", contact.sponsorId)
  } else {
    sponsor = await findSponsorByAuthUserId(ctx, user._id)
  }

  if (sponsor?.active !== true) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sponsor account is not active.",
    })
  }

  if (contact) {
    if (!contact.active || !contact.portalAccess) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sponsor portal access is not enabled for this contact.",
      })
    }
    return {
      sponsor,
      contact,
      permissions: contactPermissions(contact),
      session,
      user,
    }
  }

  if (sponsor.authUserId !== user._id) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sponsor portal access is not enabled.",
    })
  }

  return {
    sponsor,
    contact: null,
    permissions: LEGACY_PORTAL_PERMISSIONS,
    session,
    user,
  }
}
