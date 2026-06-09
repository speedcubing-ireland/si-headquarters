import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { phaseColor } from "@/convex/phases/validators"
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
import { v } from "convex/values"

export const phaseSnapshotValidator = v.union(
  v.object({
    _id: v.id("phases"),
    name: v.string(),
    color: phaseColor,
  }),
  v.null()
)

export function phaseSnapshot(phaseDoc: Doc<"phases"> | null | undefined) {
  if (!phaseDoc) return null
  return {
    _id: phaseDoc._id,
    name: phaseDoc.name,
    color: phaseDoc.color,
  }
}

export const phaseProgressValidator = v.object({
  total: v.number(),
  done: v.number(),
  cancelled: v.number(),
  incomplete: v.number(),
  inProgress: v.number(),
  blocked: v.number(),
  completionPercent: v.number(),
})

export const currentPhaseProgressValidator = v.object({
  phase: phaseSnapshotValidator,
  progress: phaseProgressValidator,
})

export const NO_CURRENT_PHASE_PROGRESS = {
  phase: null,
  progress: {
    total: 0,
    done: 0,
    cancelled: 0,
    incomplete: 0,
    inProgress: 0,
    blocked: 0,
    completionPercent: 0,
  },
} as const

export async function buildCurrentPhaseProgress(
  ctx: QueryCtx,
  phaseId: Id<"phases">
) {
  const phaseDoc = await ctx.db.get("phases", phaseId)
  return {
    phase: phaseSnapshot(phaseDoc),
    progress: await getPhaseProgressWithBlockers(ctx, phaseId),
  }
}

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
