import { ConvexError, v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireScopedObjectForRead } from "@/convex/access/scopedObject"
import { requirePrincipal } from "@/convex/permissions/principal"
import {
  objectUpdateRow,
  reactionCountValidator,
} from "@/convex/updates/validators"
import { competitionOrProjectRef } from "@/convex/utils"
import { reactions } from "@/convex/reactions"
import { getPublicUser } from "@/convex/users/queries"
import { publicUserValidator } from "@/convex/users/validators"
import { getCurrentUpdateForObject } from "@/convex/updates/model"

export const getCurrent = query({
  args: {
    object: competitionOrProjectRef,
  },
  returns: v.object({
    update: v.union(objectUpdateRow, v.null()),
    author: v.union(publicUserValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    await requireScopedObjectForRead(ctx, args.object)
    const update = await getCurrentUpdateForObject(ctx, args.object)
    const author =
      update === null ? null : await getPublicUser(ctx, update.authorId)

    return {
      update,
      author,
    }
  },
})

export const listReactionCounts = query({
  args: {
    updateId: v.id("objectUpdates"),
  },
  returns: v.array(reactionCountValidator),
  handler: async (ctx, args) => {
    const update = await ctx.db.get("objectUpdates", args.updateId)
    if (update === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Update not found",
      })
    }
    const principal = await requirePrincipal(ctx)
    await requireScopedObjectForRead(ctx, update.object)
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
