import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import {
  canPerform,
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { getMembership } from "@/convex/teams/model"
import { concreteAssigneeIds } from "@/convex/tasks/assignees"
import { resolveTaskRootContext } from "@/convex/tasks/hierarchy"

type DbCtx = QueryCtx | MutationCtx
type TaskAccessLevel = "read" | "manage"

export interface TaskAccess {
  principal: Principal
  task: Doc<"tasks">
  rootCompetition: Doc<"competitions"> | null
}

function throwTaskNotFound(): never {
  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Task not found",
  })
}

function throwForbidden(): never {
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "You do not have access to this task.",
  })
}

async function isTeamMember(
  ctx: DbCtx,
  teamId: Id<"teams">,
  userId: Id<"users">
) {
  return (await getMembership(ctx, teamId, userId)) !== null
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

export async function canManageTask(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal
) {
  const root = await resolveTaskRootContext(ctx, task)
  const rootCompetition =
    root.rootCompetitionId === null
      ? null
      : await ctx.db.get("competitions", root.rootCompetitionId)

  return (
    (rootCompetition !== null &&
      canPerform(principal, "update", "Competition", rootCompetition)) ||
    canPerform(principal, "manage", "Task")
  )
}

export async function requireTaskAccess(
  ctx: DbCtx,
  taskId: Id<"tasks">,
  level: TaskAccessLevel
): Promise<TaskAccess> {
  const principal = await requirePrincipal(ctx)
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) throwTaskNotFound()

  const root = await resolveTaskRootContext(ctx, task)
  const rootCompetition =
    root.rootCompetitionId === null
      ? null
      : await ctx.db.get("competitions", root.rootCompetitionId)

  if (root.rootCompetitionId !== null && rootCompetition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task competition not found",
    })
  }

  if (level === "manage" && (await canManageTask(ctx, task, principal))) {
    return { principal, task, rootCompetition }
  }

  if (
    level === "read" &&
    rootCompetition !== null &&
    canPerform(principal, "read", "Competition", rootCompetition)
  ) {
    return { principal, task, rootCompetition }
  }

  if (level === "read" && canPerform(principal, "manage", "Task")) {
    return { principal, task, rootCompetition }
  }

  if (
    level === "read" &&
    (await hasTaskParticipantRead(ctx, task, principal))
  ) {
    return { principal, task, rootCompetition }
  }

  throwForbidden()
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

  const principal = await requirePrincipal(ctx)
  const phase = await ctx.db.get("phases", parent.id)
  if (phase === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task parent not found",
    })
  }
  const competition = await ctx.db.get("competitions", phase.owner.id)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, "update", "Competition", competition)
  return principal
}
