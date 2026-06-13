import { defineTable } from "convex/server"
import { v } from "convex/values"

export const ORGANISER_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const ORGANISER_INVITE_PATH = "/invite/organiser"

export const competitionOrganiserInviteFields = {
  competitionId: v.id("competitions"),
  tokenHash: v.string(),
  createdByUserId: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
}

export const competitionOrganiserInvitesTable = defineTable(
  competitionOrganiserInviteFields
)
  .index("by_token_hash", ["tokenHash"])
  .index("by_competitionId", ["competitionId"])

export const organiserInviteLinkResultValidator = v.object({
  url: v.string(),
  expiresAt: v.number(),
})

export const organiserInviteSummaryValidator = v.object({
  _id: v.id("competitionOrganiserInvites"),
  createdAt: v.number(),
  expiresAt: v.number(),
  createdByName: v.string(),
})
