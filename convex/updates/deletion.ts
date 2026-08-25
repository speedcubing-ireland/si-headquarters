import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { reactions } from "@/convex/reactions"
import { v } from "convex/values"

export const deleteUpdateReactions = internalMutation({
  args: { updateId: v.id("objectUpdates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await reactions.deleteAllForTarget(ctx, args.updateId)
    return null
  },
})

export async function scheduleUpdateReactionsDeletion(
  ctx: MutationCtx,
  updateId: Id<"objectUpdates">
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.updates.deletion.deleteUpdateReactions,
    { updateId }
  )
}
