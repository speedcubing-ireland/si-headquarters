import { defineTable } from "convex/server"
import { v } from "convex/values"

export const IMPERSONATION_TICKET_TTL_MS = 5 * 60 * 1000
export const IMPERSONATION_SESSION_TTL_MS = 60 * 60 * 1000

export const INVALID_IMPERSONATION_LINK_MESSAGE =
  "Impersonation link is invalid or expired."

export const impersonationTarget = v.union(
  v.object({
    type: v.literal("user"),
    userId: v.id("users"),
  }),
  v.object({
    type: v.literal("sponsor"),
    sponsorId: v.id("sponsors"),
    sponsorAuthUserId: v.string(),
    contactId: v.optional(v.id("sponsorContacts")),
  })
)

export const impersonationRedeemedSession = v.union(
  v.object({
    kind: v.literal("hq"),
    authSessionId: v.id("authSessions"),
  }),
  v.object({
    kind: v.literal("sponsor"),
    sponsorSessionToken: v.string(),
  })
)

export const impersonationSessionFields = {
  target: impersonationTarget,
  createdByUserId: v.id("users"),
  reason: v.string(),
  tokenHash: v.string(),
  ticketExpiresAt: v.number(),
  sessionExpiresAt: v.number(),
  createdAt: v.number(),
  redeemedAt: v.optional(v.number()),
  redeemedSession: v.optional(impersonationRedeemedSession),
  consumedByNonceHash: v.optional(v.string()),
  endedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
}

export const impersonationSessionsTable = defineTable(
  impersonationSessionFields
)
  .index("by_token_hash", ["tokenHash"])
  .index("by_created_by_user_id", ["createdByUserId"])

export const impersonationLinkResultValidator = v.object({
  url: v.string(),
  ticketExpiresAt: v.number(),
  sessionExpiresAt: v.number(),
})

export const impersonationBannerValidator = v.object({
  actorUserId: v.id("users"),
  actorName: v.string(),
  expiresAt: v.number(),
  reason: v.string(),
})
