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
import { reviewerMatchesPrincipal } from "@/convex/tasks/reviews/reviewState"

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

export function isTaskOwnerOrAssignee(
  task: Doc<"tasks">,
  userId: Id<"users">,
  teamIds: ReadonlySet<Id<"teams">>
) {
  return (
    concreteAssigneeIds(task.assigneeIds).includes(userId) ||
    (task.owner !== null &&
      reviewerMatchesPrincipal(task.owner, userId, teamIds))
  )
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
    isTaskOwnerOrAssignee(task, principal.userId, new Set()) ||
    (task.owner?.type === "teams" &&
      (await isTeamMember(ctx, task.owner.id, principal.userId))) ||
    (await isTaskReviewer(ctx, task._id, principal))
  )
}

/** The task page and bulk readers share root and participant read policies. */
export async function createTaskReadAccess(
  ctx: DbCtx,
  principal: Principal,
  input: {
    competitions: Doc<"competitions">[]
    projects: Doc<"projects">[]
    taskReviewers: Doc<"taskReviewers">[]
  }
) {
  const [memberships, projectAccess] = await Promise.all([
    ctx.db
      .query("teamMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", principal.userId))
      .collect(),
    Promise.all(
      input.projects.map(async (project) =>
        (await canReadTaskViaRoot(ctx, principal, null, project))
          ? project._id
          : null
      )
    ),
  ])
  const teamIds = new Set(memberships.map((membership) => membership.teamId))
  const readableCompetitionIds = new Set(
    input.competitions
      .filter((competition) =>
        canPerform(principal, "read", "Competition", competition)
      )
      .map((competition) => competition._id)
  )
  const readableProjectIds = new Set(projectAccess.filter((id) => id !== null))
  const competitionIds = new Set(input.competitions.map((doc) => doc._id))
  const projectIds = new Set(input.projects.map((doc) => doc._id))
  const reviewerTaskIds = new Set(
    input.taskReviewers
      .filter((row) =>
        reviewerMatchesPrincipal(row.reviewer, principal.userId, teamIds)
      )
      .map((row) => row.taskId)
  )
  const managesTasks = canPerform(principal, "manage", "Task")

  function canRead(task: Doc<"tasks">): boolean {
    const rootExists =
      task.root.type === "competitions"
        ? competitionIds.has(task.root.id)
        : projectIds.has(task.root.id)
    const rootReadable =
      task.root.type === "competitions"
        ? readableCompetitionIds.has(task.root.id)
        : readableProjectIds.has(task.root.id)
    return (
      rootExists &&
      (rootReadable ||
        managesTasks ||
        isTaskOwnerOrAssignee(task, principal.userId, teamIds) ||
        reviewerTaskIds.has(task._id))
    )
  }

  return { canRead, teamIds, readableCompetitionIds, readableProjectIds }
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
  return await canManageTaskWithRoots(
    ctx,
    principal,
    await loadTaskRoots(ctx, task)
  )
}

export async function canManageTaskWithRoots(
  ctx: DbCtx,
  principal: Principal,
  {
    rootCompetition,
    rootProject,
  }: Pick<TaskAccess, "rootCompetition" | "rootProject">
) {
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

async function canReadTaskWithRoots(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal,
  rootCompetition: Doc<"competitions"> | null,
  rootProject: Doc<"projects"> | null
): Promise<boolean> {
  return (
    (await canReadTaskViaRoot(ctx, principal, rootCompetition, rootProject)) ||
    canPerform(principal, "manage", "Task") ||
    (await hasTaskParticipantRead(ctx, task, principal))
  )
}

export async function canReadTask(
  ctx: DbCtx,
  task: Doc<"tasks">,
  principal: Principal
): Promise<boolean> {
  const { rootCompetition, rootProject } = await loadTaskRoots(ctx, task)
  return await canReadTaskWithRoots(
    ctx,
    task,
    principal,
    rootCompetition,
    rootProject
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

  const { rootCompetition, rootProject } = await loadTaskRoots(ctx, task)

  if (
    level === "manage" &&
    (await canManageTaskWithRoots(ctx, principal, {
      rootCompetition,
      rootProject,
    }))
  ) {
    return { principal, task, rootCompetition, rootProject }
  }

  if (
    level === "read" &&
    (await canReadTaskWithRoots(
      ctx,
      task,
      principal,
      rootCompetition,
      rootProject
    ))
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
