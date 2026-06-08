import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"

import type { TaskParentRef } from "@/convex/tasks/validators"
type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export interface TaskRootContext {
  rootPhaseId: Id<"phases"> | null
  rootCompetitionId: Id<"competitions"> | null
}

export function taskRootPatch(root: TaskRootContext) {
  return {
    rootPhaseId: root.rootPhaseId ?? undefined,
    rootCompetitionId: root.rootCompetitionId ?? undefined,
  }
}

export async function resolveTaskRootContext(
  ctx: DbCtx,
  task: Doc<"tasks">
): Promise<TaskRootContext> {
  return await resolveTaskRootContextInternal(ctx, task, new Set())
}

async function resolveTaskRootContextInternal(
  ctx: DbCtx,
  task: Doc<"tasks">,
  visited: Set<Id<"tasks">>
): Promise<TaskRootContext> {
  if (task.rootPhaseId !== undefined && task.rootCompetitionId !== undefined) {
    return {
      rootPhaseId: task.rootPhaseId,
      rootCompetitionId: task.rootCompetitionId,
    }
  }

  return await deriveTaskRootContextFromParentInternal(
    ctx,
    task.parent,
    visited
  )
}

export async function deriveTaskRootContextFromParent(
  ctx: DbCtx,
  parent: TaskParentRef
): Promise<TaskRootContext> {
  return await deriveTaskRootContextFromParentInternal(ctx, parent, new Set())
}

async function deriveTaskRootContextFromParentInternal(
  ctx: DbCtx,
  parent: TaskParentRef,
  visited: Set<Id<"tasks">>
): Promise<TaskRootContext> {
  if (parent.type === "phases") {
    const phase = await ctx.db.get("phases", parent.id)
    if (phase === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task parent not found",
      })
    }
    return { rootPhaseId: phase._id, rootCompetitionId: phase.owner.id }
  }

  if (visited.has(parent.id)) {
    throw new Error("Task parent cycle detected")
  }
  visited.add(parent.id)
  const parentTask = await ctx.db.get("tasks", parent.id)
  if (parentTask === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task parent not found",
    })
  }
  return await resolveTaskRootContextInternal(ctx, parentTask, visited)
}

export async function getCompetitionIdForTask(
  ctx: DbCtx,
  task: Doc<"tasks">
): Promise<Id<"competitions"> | null> {
  return (await resolveTaskRootContext(ctx, task)).rootCompetitionId
}

export async function getCompetitionForTask(ctx: DbCtx, task: Doc<"tasks">) {
  const competitionId = await getCompetitionIdForTask(ctx, task)
  return competitionId === null
    ? null
    : await ctx.db.get("competitions", competitionId)
}
