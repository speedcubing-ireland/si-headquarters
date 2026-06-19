import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { throwForbidden } from "@/convex/errors"
import {
  buildPrincipalForUserId,
  canPerform,
  isDirector,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { canReadProject } from "@/convex/projects/access"
import { canReadTask } from "@/convex/tasks/access"
import type { CommentTargetRef } from "@/convex/utils"

type DbCtx = QueryCtx | MutationCtx

async function canReadCommentTarget(
  ctx: DbCtx,
  principal: Principal,
  target: CommentTargetRef
): Promise<boolean> {
  switch (target.type) {
    case "tasks": {
      const task = await ctx.db.get("tasks", target.id)
      return task !== null && (await canReadTask(ctx, task, principal))
    }
    case "competitions": {
      const competition = await ctx.db.get("competitions", target.id)
      return (
        competition !== null &&
        canPerform(principal, "read", "Competition", competition)
      )
    }
    case "projects": {
      const project = await ctx.db.get("projects", target.id)
      return project !== null && (await canReadProject(ctx, principal, project))
    }
  }
}

export async function requireCommentTargetRead(
  ctx: DbCtx,
  target: CommentTargetRef
): Promise<{ principal: Principal }> {
  const principal = await requirePrincipal(ctx)
  if (!(await canReadCommentTarget(ctx, principal, target))) {
    throwForbidden("You do not have access to this.")
  }
  return { principal }
}

export function canModerateComments(principal: Principal): boolean {
  return isDirector(principal)
}

export async function canUserReadCommentTarget(
  ctx: DbCtx,
  userId: Id<"users">,
  target: CommentTargetRef
): Promise<boolean> {
  const principal = await buildPrincipalForUserId(ctx, userId)
  return (
    principal !== null && (await canReadCommentTarget(ctx, principal, target))
  )
}

export async function filterMentionableUserIds(
  ctx: DbCtx,
  target: CommentTargetRef,
  userIds: readonly Id<"users">[]
): Promise<Id<"users">[]> {
  const readable = await Promise.all(
    userIds.map(async (userId) =>
      (await canUserReadCommentTarget(ctx, userId, target)) ? userId : null
    )
  )
  return readable.filter((userId) => userId !== null)
}
