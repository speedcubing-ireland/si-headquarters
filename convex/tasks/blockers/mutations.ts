import { mutation } from "@/convex/_generated/server"
import { getTaskBlockerEdge } from "@/convex/tasks/blockers/loader"
import { scheduleTaskUnblockedIfReady } from "@/convex/notifications/events"
import { requireTaskManageAccess } from "@/convex/tasks/access"
import { getCompetitionIdForTask } from "@/convex/tasks/hierarchy"
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

    const [blockedAccess, blockingAccess] = await Promise.all([
      requireTaskManageAccess(ctx, args.blockedTaskId),
      requireTaskManageAccess(ctx, args.blockingTaskId),
    ])
    const blockedTask = blockedAccess.task
    const blockingTask = blockingAccess.task

    const [blockedCompetitionId, blockingCompetitionId] = await Promise.all([
      getCompetitionIdForTask(ctx, blockedTask),
      getCompetitionIdForTask(ctx, blockingTask),
    ])
    if (
      blockedCompetitionId === null ||
      blockingCompetitionId === null ||
      blockedCompetitionId !== blockingCompetitionId
    ) {
      throw new Error("Blockers must belong to the same competition")
    }

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
    const { principal } = await requireTaskManageAccess(ctx, edge.blockedTaskId)

    await ctx.db.delete("taskBlockers", args.id)
    await scheduleTaskUnblockedIfReady(
      ctx,
      edge.blockedTaskId,
      principal.userId
    )
  },
})
