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
  updateId: v.nullable(v.id("competitionUpdates")),
  wcaCompetitionId: v.optional(v.string()),
}
