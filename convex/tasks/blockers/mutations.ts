import { mutation } from "@/convex/_generated/server"
import { getTaskBlockerEdge } from "@/convex/tasks/blockers/loader"
import { scheduleTaskUnblockedIfReady } from "@/convex/notifications/events"
import { getPrincipalOrNull } from "@/convex/permissions/principal"
import { v } from "convex/values"

export const addBlocker = mutation({
  args: {
    blockedTaskId: v.id("tasks"),
    blockingTaskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    if (args.blockedTaskId === args.blockingTaskId) {
      throw new Error("A task cannot block itself")
    }

    const [blockedTask, blockingTask] = await Promise.all([
      ctx.db.get("tasks", args.blockedTaskId),
      ctx.db.get("tasks", args.blockingTaskId),
    ])

    if (!blockedTask) throw new Error("Blocked task not found")
    if (!blockingTask) throw new Error("Blocking task not found")

    const existing = await getTaskBlockerEdge(
      ctx,
      args.blockedTaskId,
      args.blockingTaskId
    )
    if (existing) return existing._id

    return await ctx.db.insert("taskBlockers", {
      blockedTaskId: args.blockedTaskId,
      blockingTaskId: args.blockingTaskId,
    })
  },
})

export const removeBlocker = mutation({
  args: {
    id: v.id("taskBlockers"),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db.get("taskBlockers", args.id)
    if (!edge) return
    const principal = await getPrincipalOrNull(ctx)

    await ctx.db.delete("taskBlockers", args.id)
    await scheduleTaskUnblockedIfReady(
      ctx,
      edge.blockedTaskId,
      principal?.userId ?? null
    )
  },
})
