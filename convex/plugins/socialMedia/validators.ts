import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"
import {
  RECORD_TAGS,
  RECORD_TYPES,
} from "@/convex/plugins/socialMedia/records/kinds"

/**
 * A record as WCA Live entered it, before the WCA posts the results. Only the
 * records Headquarters cares about are kept: those set by competitors from the
 * organisation's country, or set at a competition held there.
 */
export const wcaRecordFields = {
  /** WCA Live's id for the record; a sync updates rather than duplicates it. */
  liveRecordId: v.string(),
  tag: v.union(...RECORD_TAGS.map((tag) => v.literal(tag))),
  type: v.union(...RECORD_TYPES.map((type) => v.literal(type))),
  attemptResult: v.number(),
  eventId: v.string(),
  roundName: v.string(),
  roundNumber: v.number(),
  personName: v.string(),
  /** Null for a newcomer, who has no WCA ID until results are posted. */
  wcaId: v.union(v.string(), v.null()),
  personCountryIso2: v.string(),
  /** WCA Live's id, for linking to the live results. */
  liveCompetitionId: v.string(),
  /** Joins to `competitions.wcaCompetitionId` for the HQ competition. */
  wcaCompetitionId: v.string(),
  competitionName: v.string(),
  competitionStartDate: v.string(),
  competitionEndDate: v.string(),
}

export const wcaRecordValidator = v.object(wcaRecordFields)

export type WcaRecord = Infer<typeof wcaRecordValidator>

export const wcaRecordDocValidator = v.object({
  _id: v.id("wcaRecords"),
  _creationTime: v.number(),
  ...wcaRecordFields,
})

/**
 * One row per weekly records email, keyed by the local Monday the reported week
 * starts on. Written only when a run ends: `deliver` checks it to never send a
 * week twice, and the cron reads the failure count to stop retrying.
 */
export const recordDigestRunFields = v.union(
  v.object({
    weekStart: v.string(),
    status: v.literal("sent"),
    /** Failed attempts before the one that sent. */
    failures: v.number(),
    sentAt: v.number(),
    emailId: v.string(),
    recordCount: v.number(),
  }),
  v.object({
    weekStart: v.string(),
    status: v.literal("failed"),
    failures: v.number(),
    /** Why the last attempt failed. */
    lastError: v.string(),
  })
)

export const socialMediaTables = {
  socialMediaRecordDigestRuns: defineTable(recordDigestRunFields).index(
    "by_weekStart",
    ["weekStart"]
  ),
  wcaRecords: defineTable(wcaRecordFields)
    .index("by_liveRecordId", ["liveRecordId"])
    .index("by_competitionEndDate", ["competitionEndDate"]),
}
