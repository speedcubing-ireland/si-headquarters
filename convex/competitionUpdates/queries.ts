import { query } from "@/convex/_generated/server"
import {
  competitionUpdatesFields,
  reactionCountFields,
} from "@/convex/competitionUpdates/validators"
import { publicUserValidator, toPublicUser } from "@/convex/users/validators"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

const updateWithAuthorValidator = v.nullable(
  v.object({
    _id: v.id("competitionUpdates"),
    _creationTime: v.number(),
    ...competitionUpdatesFields,
    author: v.union(publicUserValidator, v.null()),
  })
)

const reactionCountValidator = v.object({
  ...reactionCountFields,
  selected: v.boolean(),
})

export const getForCompetition = query({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: updateWithAuthorValidator,
  handler: async (ctx, args) => {
    const competition = await ctx.db.get(args.competitionId)
    if (!competition) throw new Error("Competition not found")

    const update = competition.updateId
      ? await ctx.db.get(competition.updateId)
      : null

    if (!update || update.competitionId !== competition._id) {
      return null
    }

    const author = await ctx.db.get(update.authorId)

    return {
      ...update,
      author: author ? toPublicUser(author) : null,
    }
  },
})

export const listReactionCounts = query({
  args: {
    updateId: v.id("competitionUpdates"),
  },
  returns: v.array(reactionCountValidator),
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx)
    if (!viewerId) throw new Error("Authentication required to view reactions");

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
