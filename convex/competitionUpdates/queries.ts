import { query } from "@/convex/_generated/server"
import { reactions } from "@/convex/reactions"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

const reactionCountValidator = v.object({
  emoji: v.string(),
  count: v.number(),
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

    const [counts, selectedReactions] = await Promise.all([
      reactions.getCounts(ctx, args.updateId),
      reactions.getUserReactions(ctx, args.updateId, viewerId),
    ])
    const selectedEmojis = new Set(selectedReactions)

    return counts.map(({ label, count }) => ({
      emoji: label,
      count,
      selected: selectedEmojis.has(label),
    }))
  },
})
