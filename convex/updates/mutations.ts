import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation } from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { reactions } from "@/convex/reactions"
import {
  requireScopedObjectForRead,
  requireScopedObjectForUpdate,
} from "@/convex/access/scopedObject"
import { getCurrentUpdateForObject } from "@/convex/updates/model"
import { competitionOrProjectRef } from "@/convex/utils"
import { normalizeEmoji } from "@/convex/emoji"
import { ConvexError, v } from "convex/values"

export const cleanupUpdate = internalMutation({
  args: {
    updateId: v.id("objectUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await reactions.deleteAllForTarget(ctx, args.updateId)
    const update = await ctx.db.get("objectUpdates", args.updateId)
    if (update !== null) {
      await ctx.db.delete("objectUpdates", args.updateId)
    }
    return null
  },
})

export const setCurrent = mutation({
  args: {
    object: competitionOrProjectRef,
    body: v.string(),
  },
  returns: v.id("objectUpdates"),
  handler: async (ctx, args) => {
    const { principal } = await requireScopedObjectForUpdate(ctx, args.object)
    const body = args.body.trim()
    if (!body) throw new Error("Update body is required")

    const oldUpdate = await getCurrentUpdateForObject(ctx, args.object)
    if (oldUpdate?.body === body && oldUpdate.authorId === principal.userId) {
      return oldUpdate._id
    }

    const updateId = await ctx.db.insert("objectUpdates", {
      object: args.object,
      authorId: principal.userId,
      body,
      editedAt: Date.now(),
    })

    await scheduleNotificationEvent(ctx, {
      kind: "updatePublished",
      object: args.object,
      updateId,
      actorId: principal.userId,
    })

    if (oldUpdate !== null) {
      await ctx.scheduler.runAfter(
        0,
        internal.updates.mutations.cleanupUpdate,
        {
          updateId: oldUpdate._id,
        }
      )
    }

    return updateId
  },
})

export const deleteCurrent = mutation({
  args: {
    object: competitionOrProjectRef,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireScopedObjectForUpdate(ctx, args.object)
    const update = await getCurrentUpdateForObject(ctx, args.object)
    if (update === null) return null

    await ctx.scheduler.runAfter(0, internal.updates.mutations.cleanupUpdate, {
      updateId: update._id,
    })
    return null
  },
})

export const toggleReaction = mutation({
  args: {
    updateId: v.id("objectUpdates"),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update = await ctx.db.get("objectUpdates", args.updateId)
    if (update === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Update not found",
      })
    }
    const { principal } = await requireScopedObjectForRead(ctx, update.object)
    const current = await getCurrentUpdateForObject(ctx, update.object)
    if (current === null || current._id !== update._id) {
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
