import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

/**
 * Last known WCA state for a linked competition. Raw facts rather than derived
 * milestones, because three of the milestones (`registrationClosed`,
 * `refundDeadlinePassed`, `held`) are time-dependent and would go stale in
 * storage.
 */
export const wcaCompetitionStatusFields = {
  wcaCompetitionId: v.string(),
  confirmed: v.boolean(),
  announced: v.boolean(),
  cancelled: v.boolean(),
  resultsPosted: v.boolean(),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
  registrationCloseAt: v.union(v.number(), v.null()),
  /**
   * Instant the refund window shuts, or null when the WCA has not told us.
   * Only `/v0/competitions/{id}` carries it, and that is fetched only for
   * competitions whose refund milestone can still change, so a gap is normal.
   *
   * Optional rather than nullable because rows written before the refund
   * deadline was tracked omit it entirely. Absent and `null` both mean
   * unknown; writes always set one or the other, so only reads of stored rows
   * need to allow for the gap.
   */
  refundDeadlineAt: v.optional(v.union(v.number(), v.null())),
  fetchedAt: v.number(),
}

export const wcaCompetitionStatusValidator = v.object(
  wcaCompetitionStatusFields
)

export type WcaCompetitionStatus = Infer<typeof wcaCompetitionStatusValidator>

/**
 * What one sync run actually observed, before it is merged with what we already
 * knew. `null` means "the sources available this run could not determine this",
 * which is different from "false" — only `/competitions/mine` knows whether a
 * competition is confirmed or cancelled, and only the country index carries a
 * registration close date, so either being absent leaves a genuine gap.
 */
export const wcaCompetitionObservationValidator = v.object({
  ...wcaCompetitionStatusFields,
  // These two, and only these two, can come back unknown.
  confirmed: v.union(v.boolean(), v.null()),
  cancelled: v.union(v.boolean(), v.null()),
  // An observation is always built fresh, so unlike the stored row it never
  // omits this — `null` there means "no detail fetched this run".
  refundDeadlineAt: v.union(v.number(), v.null()),
})

export type WcaCompetitionObservation = Infer<
  typeof wcaCompetitionObservationValidator
>

export const wcaTables = {
  wcaCompetitionStatuses: defineTable(wcaCompetitionStatusFields).index(
    "by_wcaCompetitionId",
    ["wcaCompetitionId"]
  ),
}
