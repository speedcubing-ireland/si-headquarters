import { v } from "convex/values"
import { competitionOrProjectRef } from "@/convex/utils"

export const objectUpdatesFields = {
  object: competitionOrProjectRef,
  authorId: v.id("users"),
  body: v.string(),
  editedAt: v.number(),
}

export const objectUpdateRow = v.object({
  _id: v.id("objectUpdates"),
  _creationTime: v.number(),
  ...objectUpdatesFields,
})

export const reactionCountValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  selected: v.boolean(),
})
