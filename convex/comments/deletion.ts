import { internal } from "@/convex/_generated/api"
import type { MutationCtx } from "@/convex/_generated/server"
import { internalMutation } from "@/convex/_generated/server"
import { comments } from "@/convex/comments/client"
import {
  commentTargetRef,
  objectRefKey,
  type CommentTargetRef,
} from "@/convex/utils"
import { v } from "convex/values"

async function deleteCommentsForTarget(
  ctx: MutationCtx,
  target: CommentTargetRef
): Promise<void> {
  const zone = await comments.getZone(ctx, {
    entityId: objectRefKey(target),
  })
  if (zone === null) return

  await comments.deleteZone(ctx, { zoneId: zone._id })
}

export const deleteTargetComments = internalMutation({
  args: { target: commentTargetRef },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteCommentsForTarget(ctx, args.target)
    return null
  },
})

export async function scheduleCommentsDeletion(
  ctx: MutationCtx,
  target: CommentTargetRef
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.comments.deletion.deleteTargetComments,
    { target }
  )
}
