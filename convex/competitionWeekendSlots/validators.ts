import { v } from "convex/values"

export const competitionWeekendSlotFields = {
  year: v.number(),
  /** Saturday of the weekend, `YYYY-MM-DD`. */
  weekendStart: v.string(),
  note: v.string(),
  announced: v.boolean(),
  reserved: v.boolean(),
}
