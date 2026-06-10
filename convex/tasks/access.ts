import { ConvexError } from "convex/values"
import { requireScopedObjectForUpdate } from "@/convex/access/scopedObject"
import { throwForbidden } from "@/convex/errors"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  canPerform,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { canReadProject, canUpdateProject } from "@/convex/projects/access"
import { isTeamMember } from "@/convex/teams/model"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"

type DbCtx = QueryCtx | MutationCtx
type TaskAccessLevel = "read" | "manage"

export interface TaskAccess {
  principal: Principal
  task: Doc<"tasks">
  rootCompetition: Doc<"competitions"> | null
  rootProject: Doc<"projects"> | null
}

function throwTaskNotFound(): never {
  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Task not found",
  })
}

async function isTaskOwnerOrAssignee(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal
) {
  if (concreteAssigneeIds(task.assigneeIds).includes(principal.userId)) {
    return true
  }
  if (task.owner?.type === "users" && task.owner.id === principal.userId) {
    return true
  }
  if (task.owner?.type === "teams") {
    return await isTeamMember(ctx, task.owner.id, principal.userId)
  }
  return false
}

export async function isTaskReviewer(
  ctx: DbCtx,
  taskId: Id<"tasks">,
  principal: Principal
) {
  const reviewers = await ctx.db
    .query("taskReviewers")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .collect()

  for (const reviewer of reviewers) {
    if (await isReviewerRefForPrincipal(ctx, reviewer.reviewer, principal)) {
      return true
    }
  }
  return false
}

export async function isReviewerRefForPrincipal(
  ctx: DbCtx,
  reviewer: Doc<"taskReviewers">["reviewer"],
  principal: Principal
) {
  if (reviewer.type === "users") {
    return reviewer.id === principal.userId
  }
  return await isTeamMember(ctx, reviewer.id, principal.userId)
}

async function hasTaskParticipantRead(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal
) {
  return (
    (await isTaskOwnerOrAssignee(ctx, task, principal)) ||
    (await isTaskReviewer(ctx, task._id, principal))
  )
}

async function loadTaskRoots(ctx: DbCtx, task: Doc<"tasks">) {
  const [rootCompetition, rootProject] = await Promise.all([
    task.root.type === "competitions"
      ? ctx.db.get("competitions", task.root.id)
      : null,
    task.root.type === "projects" ? ctx.db.get("projects", task.root.id) : null,
  ])

  if (task.root.type === "competitions" && rootCompetition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task competition not found",
    })
  }

  if (task.root.type === "projects" && rootProject === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task project not found",
    })
  }

  return { rootCompetition, rootProject }
}

export async function canManageTask(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal
) {
  const { rootCompetition, rootProject } = await loadTaskRoots(ctx, task)

  return (
    (rootCompetition !== null &&
      canPerform(principal, "update", "Competition", rootCompetition)) ||
    (rootProject !== null &&
      (await canUpdateProject(ctx, principal, rootProject))) ||
    canPerform(principal, "manage", "Task")
  )
}

async function canReadTaskViaRoot(
  ctx: DbCtx,
  principal: Principal,
  rootCompetition: Doc<"competitions"> | null,
  rootProject: Doc<"projects"> | null
) {
  if (
    rootCompetition !== null &&
    canPerform(principal, "read", "Competition", rootCompetition)
  ) {
    return true
  }

  if (
    rootProject !== null &&
    (await canReadProject(ctx, principal, rootProject))
  ) {
    return true
  }

  return false
}

export async function requireTaskAccess(
  ctx: DbCtx,
  taskId: Id<"tasks">,
  level: TaskAccessLevel
): Promise<TaskAccess> {
  const principal = await requirePrincipal(ctx)
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) throwTaskNotFound()

  const { rootCompetition, rootProject } = await loadTaskRoots(ctx, task)

  if (level === "manage" && (await canManageTask(ctx, task, principal))) {
    return { principal, task, rootCompetition, rootProject }
  }

  if (
    level === "read" &&
    (await canReadTaskViaRoot(ctx, principal, rootCompetition, rootProject))
  ) {
    return { principal, task, rootCompetition, rootProject }
  }

  if (level === "read" && canPerform(principal, "manage", "Task")) {
    return { principal, task, rootCompetition, rootProject }
  }

  if (
    level === "read" &&
    (await hasTaskParticipantRead(ctx, task, principal))
  ) {
    return { principal, task, rootCompetition, rootProject }
  }

  throwForbidden("You do not have access to this task.")
}

export async function requireTaskReadAccess(ctx: DbCtx, taskId: Id<"tasks">) {
  return await requireTaskAccess(ctx, taskId, "read")
}

export async function requireTaskManageAccess(ctx: DbCtx, taskId: Id<"tasks">) {
  return await requireTaskAccess(ctx, taskId, "manage")
}

export async function requireTaskCreationParentAccess(
  ctx: DbCtx,
  parent: Doc<"tasks">["parent"]
): Promise<Principal> {
  if (parent.type === "tasks") {
    return (await requireTaskManageAccess(ctx, parent.id)).principal
  }

  const phase = await ctx.db.get("phases", parent.id)
  if (phase === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task parent not found",
    })
  }

  const { principal } = await requireScopedObjectForUpdate(ctx, phase.owner)
  return principal
}
