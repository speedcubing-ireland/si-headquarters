import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  buildTaskStatusView,
  TaskStatusLoader,
} from "@/convex/tasks/status/resolver"
import {
  getProgress,
  isTerminalComplete,
  toPhaseProgressBuckets,
} from "@/convex/tasks/status/rules"

export async function getPhaseProgressWithBlockers(
  ctx: QueryCtx,
  phaseId: Id<"phases">
) {
  const statusLoader = new TaskStatusLoader(ctx)
  const blockersLoader = new TaskBlockersLoader(ctx)
  const tasks = await statusLoader.getPhaseTasks(phaseId)
  const statusViews = await Promise.all(
    tasks.map((task) => buildTaskStatusView(statusLoader, task))
  )
  const statuses = statusViews.map((view) => view.effectiveStatus)
  const progress = getProgress(statuses)

  const blockedCounts = await Promise.all(
    tasks
      .filter((_, index) => !isTerminalComplete(statuses[index]))
      .map((task) => blockersLoader.getCounts(task._id, statusLoader))
  )
  const blocked = blockedCounts.filter((counts) => counts.openCount > 0).length

  return toPhaseProgressBuckets(progress, blocked)
}
