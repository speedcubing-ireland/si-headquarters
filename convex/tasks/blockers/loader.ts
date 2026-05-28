import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { BlockerCounts } from "@/convex/tasks/blockers/counts"
import { buildTaskStatusView } from "@/convex/tasks/status/resolver"
import type { TaskStatusLoader } from "@/convex/tasks/status/resolver"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
type BlockerReadCtx = QueryCtx | MutationCtx

export const MAX_TASK_BLOCKERS = 50

export class TaskBlockersLoader {
  private readonly ctx: BlockerReadCtx
  private readonly blockersOfCache = new Map<
    Id<"tasks">,
    Promise<Doc<"taskBlockers">[]>
  >()
  private readonly blockedByCache = new Map<
    Id<"tasks">,
    Promise<Doc<"taskBlockers">[]>
  >()
  private readonly countsCache = new Map<
    Id<"tasks">,
    Promise<BlockerCounts>
  >()

  constructor(ctx: BlockerReadCtx) {
    this.ctx = ctx
  }

  async getBlockersOf(taskId: Id<"tasks">): Promise<Doc<"taskBlockers">[]> {
    const existing = this.blockersOfCache.get(taskId)
    if (existing) return await existing

    const promise = this.ctx.db
      .query("taskBlockers")
      .withIndex("by_blockedTaskId_and_blockingTaskId", (q) =>
        q.eq("blockedTaskId", taskId)
      )
      .take(MAX_TASK_BLOCKERS + 1)
      .then((edges) => {
        if (edges.length > MAX_TASK_BLOCKERS) {
          throw new Error(
            `Task has more than ${String(MAX_TASK_BLOCKERS)} blockers`
          )
        }
        return edges
      })

    this.blockersOfCache.set(taskId, promise)
    return await promise
  }

  async getBlockedBy(taskId: Id<"tasks">): Promise<Doc<"taskBlockers">[]> {
    const existing = this.blockedByCache.get(taskId)
    if (existing) return await existing

    const promise = this.ctx.db
      .query("taskBlockers")
      .withIndex("by_blockingTaskId_and_blockedTaskId", (q) =>
        q.eq("blockingTaskId", taskId)
      )
      .take(MAX_TASK_BLOCKERS + 1)
      .then((edges) => {
        if (edges.length > MAX_TASK_BLOCKERS) {
          throw new Error(
            `Task is blocking more than ${String(MAX_TASK_BLOCKERS)} tasks`
          )
        }
        return edges
      })

    this.blockedByCache.set(taskId, promise)
    return await promise
  }

  async getCounts(
    taskId: Id<"tasks">,
    statusLoader: TaskStatusLoader
  ): Promise<BlockerCounts> {
    const existing = this.countsCache.get(taskId)
    if (existing) return await existing

    const promise = this.computeCounts(taskId, statusLoader)
    this.countsCache.set(taskId, promise)
    return await promise
  }

  private async computeCounts(
    taskId: Id<"tasks">,
    statusLoader: TaskStatusLoader
  ): Promise<BlockerCounts> {
    const edges = await this.getBlockersOf(taskId)
    if (edges.length === 0) {
      return { count: 0, openCount: 0, blockedBy: [] }
    }

    const blockingTasks = (
      await Promise.all(
        edges.map((edge) => statusLoader.getTask(edge.blockingTaskId))
      )
    ).filter((task): task is Doc<"tasks"> => task !== null)

    const statusViews = await Promise.all(
      blockingTasks.map((task) => buildTaskStatusView(statusLoader, task))
    )

    const blockedBy = blockingTasks.map((task, index) => ({
      name: task.name,
      isOpen: !isTerminalComplete(statusViews[index].effectiveStatus),
    }))

    const openCount = blockedBy.filter((entry) => entry.isOpen).length

    return {
      count: edges.length,
      openCount,
      blockedBy,
    }
  }
}

export async function getTaskBlockerEdge(
  ctx: BlockerReadCtx,
  blockedTaskId: Id<"tasks">,
  blockingTaskId: Id<"tasks">
): Promise<Doc<"taskBlockers"> | null> {
  return await ctx.db
    .query("taskBlockers")
    .withIndex("by_blockedTaskId_and_blockingTaskId", (q) =>
      q
        .eq("blockedTaskId", blockedTaskId)
        .eq("blockingTaskId", blockingTaskId)
    )
    .unique()
}
