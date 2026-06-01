import { query } from "@/convex/_generated/server"
import { requireCan, requirePrincipal } from "@/convex/permissions/principal"
import { reactions } from "@/convex/reactions"
import { ConvexError, v } from "convex/values"

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
    const principal = await requirePrincipal(ctx)
    const update = await ctx.db.get("competitionUpdates", args.updateId)
    if (update === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition update not found",
      })
    }
    const competition = await ctx.db.get("competitions", update.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }
    requireCan(principal, "read", "Competition", competition)

    const [counts, selectedReactions] = await Promise.all([
      reactions.getCounts(ctx, args.updateId),
      reactions.getUserReactions(ctx, args.updateId, principal.userId),
    ])
    const selectedEmojis = new Set(selectedReactions)

    return counts.map(({ label, count }) => ({
      emoji: label,
      count,
      selected: selectedEmojis.has(label),
    }))
  },
})
