import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

export const recordDigestRunStatus = v.union(
  v.literal("running"),
  v.literal("sent"),
  v.literal("skipped"),
  v.literal("failed")
)

export type RecordDigestRunStatus = Infer<typeof recordDigestRunStatus>

/**
 * One row per weekly records email, keyed by the local Monday the reported week
 * starts on. It is what stops the hourly Monday cron sending twice, and what
 * lets it retry a run that failed.
 */
export const recordDigestRunFields = v.object({
  weekStart: v.string(),
  status: recordDigestRunStatus,
  attempts: v.number(),
  startedAt: v.number(),
  sentAt: v.optional(v.number()),
  emailId: v.optional(v.string()),
  recordCount: v.optional(v.number()),
  /** Why the last attempt failed, or why the run was skipped. */
  lastError: v.optional(v.string()),
})

export const socialMediaTables = {
  socialMediaRecordDigestRuns: defineTable(recordDigestRunFields).index(
    "by_weekStart",
    ["weekStart"]
  ),
}
