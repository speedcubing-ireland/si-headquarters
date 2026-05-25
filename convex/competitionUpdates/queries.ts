import { query } from "@/convex/_generated/server"
import {
  reactionCountFields,
} from "@/convex/competitionUpdates/validators"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

const reactionCountValidator = v.object({
  ...reactionCountFields,
  selected: v.boolean(),
})

export const listReactionCounts = query({
  args: {
    updateId: v.id("competitionUpdates"),
  },
  returns: v.array(reactionCountValidator),
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx)
    if (!viewerId) throw new Error("Authentication required to view reactions")

    const selectedEmojis = new Set<string>()
    const reactionCounts: Array<{
      emoji: string
      count: number
      selected: boolean
    }> = []

    const reactionsQuery = ctx.db
      .query("competitionUpdateReactions")
      .withIndex("by_updateId_and_userId_and_emoji", (q) =>
        q.eq("updateId", args.updateId).eq("userId", viewerId)
      )

    for await (const reaction of reactionsQuery) {
      selectedEmojis.add(reaction.emoji)
    }

    const countsQuery = ctx.db
      .query("competitionUpdateReactionCounts")
      .withIndex("by_updateId_and_emoji", (q) =>
        q.eq("updateId", args.updateId)
      )

    for await (const { emoji, count } of countsQuery) {
      reactionCounts.push({
        emoji,
        count,
        selected: selectedEmojis.has(emoji),
      })
    }

    return reactionCounts
  },
})
