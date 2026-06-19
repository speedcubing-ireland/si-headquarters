import { v } from "convex/values"
import { publicUserValidator } from "@/convex/users/validators"

export const commentMentionValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
})

export const commentReactionValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  selected: v.boolean(),
})

export const commentRowValidator = v.object({
  messageId: v.string(),
  author: v.union(publicUserValidator, v.null()),
  body: v.string(),
  mentions: v.array(commentMentionValidator),
  reactions: v.array(commentReactionValidator),
  createdAt: v.number(),
  isEdited: v.boolean(),
  mine: v.boolean(),
})

export const commentListValidator = v.object({
  canModerate: v.boolean(),
  comments: v.array(commentRowValidator),
})
