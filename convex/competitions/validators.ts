import { v } from "convex/values"

export const competitionPeopleFields = {
  compLead: v.nullable(v.id("users")),
  leadDelegate: v.nullable(v.id("users")),
  organisers: v.array(v.id("users")),
}

export const competitionDatesFields = {
  from: v.nullable(v.string()),
  to: v.nullable(v.string()),
}

export const competitionsCoreFields = {
  name: v.string(),
  description: v.nullable(v.string()),
  people: v.object(competitionPeopleFields),
  compDates: v.object(competitionDatesFields),
  phaseId: v.nullable(v.id("phases")),
  wcaCompetitionId: v.optional(v.string()),
  /**
   * Set when the WCA reports the competition as cancelled. Orthogonal to the
   * phase: a cancelled competition keeps whatever phase it reached. Written
   * only by the WCA status sync.
   */
  cancelledAt: v.optional(v.number()),
}
