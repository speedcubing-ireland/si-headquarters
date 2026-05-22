import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

const CLEANUP_BATCH_SIZE = 100
const EMOJI_REGEX =
  /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D]+$/u

function normalizeEmoji(value: string) {
  const emoji = value.trim()

  if (!emoji) throw new Error("Reaction emoji is required")
  if (Array.from(emoji).length > 16)
    throw new Error("Reaction emoji is too long")
  if (!EMOJI_REGEX.test(emoji))
    throw new Error("Reaction emoji must be an emoji")

  return emoji
}

async function getUserId(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("Authentication required")
  return userId
}

export const cleanupUpdate = internalMutation({
  args: {
    updateId: v.id("competitionUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("competitionUpdateReactions")
      .withIndex("by_updateId_and_userId_and_emoji", (q) =>
        q.eq("updateId", args.updateId)
      )
      .take(CLEANUP_BATCH_SIZE)
    const reactionCounts = await ctx.db
      .query("competitionUpdateReactionCounts")
      .withIndex("by_updateId_and_emoji", (q) =>
        q.eq("updateId", args.updateId)
      )
      .take(CLEANUP_BATCH_SIZE)

    await Promise.all([
      ...reactions.map((reaction) => ctx.db.delete(reaction._id)),
      ...reactionCounts.map((reactionCount) =>
        ctx.db.delete(reactionCount._id)
      ),
    ])

    if (
      reactions.length === CLEANUP_BATCH_SIZE ||
      reactionCounts.length === CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.competitionUpdates.mutations.cleanupUpdate,
        args
      )
      return null
    }

    await ctx.db.delete(args.updateId)
    return null
  },
})

export const setForCompetition = mutation({
  args: {
    competitionId: v.id("competitions"),
    body: v.string(),
  },
  returns: v.id("competitionUpdates"),
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx)
    const competition = await ctx.db.get(args.competitionId)
    if (!competition) throw new Error("Competition not found")

    const body = args.body.trim()
    if (!body) throw new Error("Update body is required")

    const oldUpdateId = competition.updateId
    const updateId = await ctx.db.insert("competitionUpdates", {
      competitionId: competition._id,
      authorId: userId,
      body,
      editedAt: Date.now(),
    })

    await ctx.db.patch(competition._id, { updateId })

    if (oldUpdateId) {
      await ctx.scheduler.runAfter(
        0,
        internal.competitionUpdates.mutations.cleanupUpdate,
        { updateId: oldUpdateId }
      )
    }

    return updateId
  },
})

export const deleteForCompetition = mutation({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx)
    const competition = await ctx.db.get(args.competitionId)
    if (!competition) throw new Error("Competition not found")

    const canDelete =
      competition.people.compLead === userId ||
      competition.people.leadDelegate === userId ||
      competition.people.organisers.some(
        (organiserId) => organiserId === userId
      )
    if (!canDelete) {
      throw new Error("Not authorized to delete this competition update")
    }

    if (!competition.updateId) return null

    await ctx.db.patch(competition._id, { updateId: null })
    await ctx.scheduler.runAfter(
      0,
      internal.competitionUpdates.mutations.cleanupUpdate,
      { updateId: competition.updateId }
    )

    return null
  },
})

export const toggleReaction = mutation({
  args: {
    updateId: v.id("competitionUpdates"),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx)
    const update = await ctx.db.get(args.updateId)
    if (!update) throw new Error("Competition update not found")

    const competition = await ctx.db.get(update.competitionId)
    if (!competition || competition.updateId !== update._id) {
      throw new Error("Cannot react to an archived update")
    }

    const emoji = normalizeEmoji(args.emoji)
    const existingReaction = await ctx.db
      .query("competitionUpdateReactions")
      .withIndex("by_updateId_and_userId_and_emoji", (q) =>
        q.eq("updateId", args.updateId).eq("userId", userId).eq("emoji", emoji)
      )
      .unique()
    const reactionCount = await ctx.db
      .query("competitionUpdateReactionCounts")
      .withIndex("by_updateId_and_emoji", (q) =>
        q.eq("updateId", args.updateId).eq("emoji", emoji)
      )
      .unique()

    if (existingReaction) {
      await ctx.db.delete(existingReaction._id)

      if (!reactionCount) return null

      const nextCount = reactionCount.count - 1
      if (nextCount > 0) {
        await ctx.db.patch(reactionCount._id, { count: nextCount })
      } else {
        await ctx.db.delete(reactionCount._id)
      }

      return null
    }

    await ctx.db.insert("competitionUpdateReactions", {
      updateId: args.updateId,
      userId,
      emoji,
    })

    if (reactionCount) {
      await ctx.db.patch(reactionCount._id, {
        count: reactionCount.count + 1,
      })
      return null
    }

    await ctx.db.insert("competitionUpdateReactionCounts", {
      updateId: args.updateId,
      emoji,
      count: 1,
    })

    return null
  },
})
