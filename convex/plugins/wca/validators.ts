import { defineTable } from "convex/server"
import { v, type Infer } from "convex/values"

/**
 * Last known WCA state for a linked competition. Raw facts rather than derived
 * milestones, because two of the milestones (`registrationClosed`, `held`) are
 * time-dependent and would go stale in storage.
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
