import { v } from "convex/values"

export const competitionUpdatesFields = {
  competitionId: v.id("competitions"),
  authorId: v.id("users"),
  body: v.string(),
  editedAt: v.number(),
}
