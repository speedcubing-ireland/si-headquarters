import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"

import type { TaskParentRef, TaskRootPhaseRef } from "@/convex/tasks/validators"
import type { CompetitionOrProjectRef } from "@/convex/utils"

type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export interface TaskRootContext {
  rootPhase: TaskRootPhaseRef
  root: CompetitionOrProjectRef
}

export function taskRootPatch(root: TaskRootContext) {
  return {
    rootPhase: root.rootPhase,
    root: root.root,
  }
}

function rootContextForPhaseOwner(
  phaseId: Id<"phases">,
  owner: Doc<"phases">["owner"]
): TaskRootContext {
  return {
    rootPhase: { type: "phases", id: phaseId },
    root: owner,
  }
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
    return rootContextForPhaseOwner(phase._id, phase.owner)
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
  return {
    rootPhase: parentTask.rootPhase,
    root: parentTask.root,
  }
}

export function getTaskRootRef(task: Doc<"tasks">): CompetitionOrProjectRef {
  return task.root
}

export function taskRootsMatch(a: Doc<"tasks">, b: Doc<"tasks">): boolean {
  return a.root.type === b.root.type && a.root.id === b.root.id
}

export const COMPETITION_SCOPED_INTEGRATION_MESSAGE =
  "Task integrations require a competition-scoped task."

export function requireCompetitionScopedTask(
  task: Doc<"tasks">
): Id<"competitions"> {
  if (task.root.type !== "competitions") {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: COMPETITION_SCOPED_INTEGRATION_MESSAGE,
    })
  }
  return task.root.id
}

export function getCompetitionIdForTask(
  task: Doc<"tasks">
): Id<"competitions"> | null {
  return task.root.type === "competitions" ? task.root.id : null
}

export function getProjectIdForTask(task: Doc<"tasks">): Id<"projects"> | null {
  return task.root.type === "projects" ? task.root.id : null
}

export async function getCompetitionForTask(ctx: DbCtx, task: Doc<"tasks">) {
  const competitionId = getCompetitionIdForTask(task)
  return competitionId === null
    ? null
    : await ctx.db.get("competitions", competitionId)
}

export async function getProjectForTask(ctx: DbCtx, task: Doc<"tasks">) {
  const projectId = getProjectIdForTask(task)
  return projectId === null ? null : await ctx.db.get("projects", projectId)
}
