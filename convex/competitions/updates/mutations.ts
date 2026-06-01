import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  canPerform,
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { reactions } from "@/convex/reactions"
import { ConvexError, v } from "convex/values"

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

function canDeleteCompetitionUpdate(
  principal: Principal,
  competition: Doc<"competitions">
): boolean {
  if (canPerform(principal, "manage", "Competition", competition)) {
    return true
  }
  return (
    competition.people.compLead === principal.userId ||
    competition.people.leadDelegate === principal.userId ||
    competition.people.organisers.includes(principal.userId)
  )
}

async function authorizeCompetitionUpdate(
  ctx: MutationCtx,
  competitionId: Doc<"competitions">["_id"],
  action: "read" | "update"
) {
  const principal = await requirePrincipal(ctx)
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, action, "Competition", competition)
  return { principal, competition }
}

export const cleanupUpdate = internalMutation({
  args: {
    updateId: v.id("competitionUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await reactions.deleteAllForTarget(ctx, args.updateId)
    await ctx.db.delete("competitionUpdates", args.updateId)
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
    const { principal, competition } = await authorizeCompetitionUpdate(
      ctx,
      args.competitionId,
      "update"
    )

    const body = args.body.trim()
    if (!body) throw new Error("Update body is required")

    const oldUpdateId = competition.updateId
    if (oldUpdateId) {
      const oldUpdate = await ctx.db.get("competitionUpdates", oldUpdateId)
      if (
        oldUpdate?.competitionId === competition._id &&
        oldUpdate.body === body &&
        oldUpdate.authorId === principal.userId
      ) {
        return oldUpdate._id
      }
    }

    const updateId = await ctx.db.insert("competitionUpdates", {
      competitionId: competition._id,
      authorId: principal.userId,
      body,
      editedAt: Date.now(),
    })

    await ctx.db.patch("competitions", competition._id, { updateId })

    if (oldUpdateId) {
      await ctx.scheduler.runAfter(
        0,
        internal.competitions.updates.mutations.cleanupUpdate,
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
    const principal = await requirePrincipal(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }
    if (!canDeleteCompetitionUpdate(principal, competition)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Not authorized to delete this competition update",
      })
    }

    if (!competition.updateId) return null

    await ctx.db.patch("competitions", competition._id, { updateId: null })
    await ctx.scheduler.runAfter(
      0,
      internal.competitions.updates.mutations.cleanupUpdate,
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
    const update = await ctx.db.get("competitionUpdates", args.updateId)
    if (!update) throw new Error("Competition update not found")

    const { principal } = await authorizeCompetitionUpdate(
      ctx,
      update.competitionId,
      "read"
    )

    const competition = await ctx.db.get("competitions", update.competitionId)
    if (competition?.updateId !== update._id) {
      throw new Error("Cannot react to an archived update")
    }

    const emoji = normalizeEmoji(args.emoji)
    const existingReaction = await reactions.hasUserReacted(
      ctx,
      args.updateId,
      emoji,
      principal.userId
    )

    if (existingReaction) {
      await reactions.remove(ctx, args.updateId, emoji, principal.userId)
      return null
    }

    await reactions.add(
      ctx,
      args.updateId,
      emoji,
      principal.userId,
      undefined,
      true
    )

    return null
  },
})
