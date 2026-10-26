import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"
import {
  RECORD_STATUSES,
  RECORD_TAGS,
  RECORD_TYPES,
} from "@/convex/plugins/socialMedia/records/kinds"

/**
 * A record as WCA Live entered it, until the WCA posts the results and the
 * daily confirmation replaces it with the WCA's version. Only the records
 * Headquarters cares about are kept: those set by competitors from the
 * organisation's country, or set at a competition held there. Older records
 * come from the WCA's records history, imported by
 * `scripts/backfill-records.ts`.
 */
export const wcaRecordFields = {
  /**
   * WCA Live's id for the record; a sync updates rather than duplicates it.
   * An imported record has `wca:<result id>:<type>` instead.
   */
  liveRecordId: v.string(),
  /**
   * `live` until the WCA posts the competition's results; then `confirmed`,
   * with the WCA's values, or `notRecord`. Syncs leave the last two alone.
   */
  status: v.union(...RECORD_STATUSES.map((status) => v.literal(status))),
  tag: v.union(...RECORD_TAGS.map((tag) => v.literal(tag))),
  type: v.union(...RECORD_TYPES.map((type) => v.literal(type))),
  attemptResult: v.number(),
  eventId: v.string(),
  roundName: v.string(),
  roundNumber: v.number(),
  personName: v.string(),
  /**
   * Null for a newcomer, who has no WCA ID until results are posted; the
   * confirmation fills it in.
   */
  wcaId: v.union(v.string(), v.null()),
  personCountryIso2: v.string(),
  /**
   * WCA Live's id, for linking to the live results. Null for an imported
   * record, whose results the WCA had already posted.
   */
  liveCompetitionId: v.union(v.string(), v.null()),
  /** Joins to `competitions.wcaCompetitionId` for the HQ competition. */
  wcaCompetitionId: v.string(),
  competitionName: v.string(),
  competitionStartDate: v.string(),
  competitionEndDate: v.string(),
  /**
   * When the daily confirmation confirmed a record WCA Live entered, so the
   * next weekly email lists it as confirmed. Absent on a record imported
   * already confirmed from the WCA's history.
   */
  confirmedAt: v.optional(v.number()),
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
    /**
     * The confirmation time up to which this email listed confirmed records;
     * the next email lists those confirmed after it. Absent on runs sent
     * before records were split into confirmed and provisional.
     */
    confirmedThrough: v.optional(v.number()),
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
    .index("by_competitionEndDate", ["competitionEndDate"])
    .index("by_wcaCompetitionId_and_eventId", ["wcaCompetitionId", "eventId"])
    .index("by_status_and_competitionEndDate", ["status", "competitionEndDate"])
    .index("by_personCountryIso2_and_confirmedAt", [
      "personCountryIso2",
      "confirmedAt",
    ]),
}
