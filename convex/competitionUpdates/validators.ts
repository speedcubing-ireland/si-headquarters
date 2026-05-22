import { v } from "convex/values"

export const reactionCountFields = {
  emoji: v.string(),
  count: v.number(),
}

export const competitionUpdatesFields = {
  competitionId: v.id("competitions"),
  authorId: v.id("users"),
  body: v.string(),
  editedAt: v.number(),
}

export const competitionUpdateReactionsFields = {
  updateId: v.id("competitionUpdates"),
  userId: v.id("users"),
  emoji: v.string(),
}

export const competitionUpdateReactionCountsFields = {
  updateId: v.id("competitionUpdates"),
  ...reactionCountFields,
}
