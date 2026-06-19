import { v } from "convex/values"

export const competitionWeekendSlotFields = {
  year: v.number(),
  weekendStart: v.string(),
  note: v.string(),
  announced: v.boolean(),
  reserved: v.boolean(),
}
