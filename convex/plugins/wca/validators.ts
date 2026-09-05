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
  reportPosted: v.boolean(),
  startDate: v.union(v.string(), v.null()),
  endDate: v.union(v.string(), v.null()),
  registrationCloseAt: v.union(v.number(), v.null()),
  fetchedAt: v.number(),
}

export const wcaCompetitionStatusValidator = v.object(
  wcaCompetitionStatusFields
)

export type WcaCompetitionStatus = Infer<typeof wcaCompetitionStatusValidator>

export const wcaTables = {
  wcaCompetitionStatuses: defineTable(wcaCompetitionStatusFields).index(
    "by_wcaCompetitionId",
    ["wcaCompetitionId"]
  ),
}
