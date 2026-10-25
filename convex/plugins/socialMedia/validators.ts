import { defineTable } from "convex/server"
import { v } from "convex/values"

export const recordDigestRunStatus = v.union(
  v.literal("sent"),
  v.literal("failed")
)

/**
 * One row per weekly records email, keyed by the local Monday the reported week
 * starts on. Written only when a run ends: `deliver` checks it to never send a
 * week twice, and the cron reads the failure count to stop retrying.
 */
export const recordDigestRunFields = v.object({
  weekStart: v.string(),
  status: recordDigestRunStatus,
  failures: v.number(),
  sentAt: v.optional(v.number()),
  emailId: v.optional(v.string()),
  recordCount: v.optional(v.number()),
  /** Why the last attempt failed. */
  lastError: v.optional(v.string()),
})

export const socialMediaTables = {
  socialMediaRecordDigestRuns: defineTable(recordDigestRunFields).index(
    "by_weekStart",
    ["weekStart"]
  ),
}
