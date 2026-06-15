import { defineTable } from "convex/server"
import { v } from "convex/values"

export const ORGANISER_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_ACTIVE_ORGANISER_INVITES = 50

export const ORGANISER_INVITE_PATH = "/invite/organiser"

export const competitionOrganiserInvitesTable = defineTable({
  competitionId: v.id("competitions"),
  tokenHash: v.string(),
  createdByUserId: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
})
  .index("by_token_hash", ["tokenHash"])
  .index("by_competitionId", ["competitionId"])
  .index("by_competitionId_and_revokedAt_and_expiresAt", [
    "competitionId",
    "revokedAt",
    "expiresAt",
  ])
