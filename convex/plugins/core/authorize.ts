import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { internalQuery } from "@/convex/_generated/server"

type AuthCtx = QueryCtx | MutationCtx
import {
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import { getCompetitionIdForTask } from "@/convex/tasks/blockers/competition"

type DbCtx = QueryCtx | MutationCtx

export const assertCompetitionUpdateAccess = internalQuery({
  args: { competitionId: v.id("competitions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCompetitionForUpdate(ctx, args.competitionId)
    return null
  },
})

export async function requireCompetitionForUpdate(
  ctx: DbCtx,
  competitionId: Id<"competitions">
): Promise<{ principal: Principal; competition: Doc<"competitions"> }> {
  const principal = await requirePrincipal(ctx)
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, "update", "Competition", competition)
  return { principal, competition }
}

export async function requireCompetitionForRead(
  ctx: DbCtx,
  competitionId: Id<"competitions">
): Promise<Doc<"competitions">> {
  const principal = await requirePrincipal(ctx)
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, "read", "Competition", competition)
  return competition
}

export async function requireTaskIntegrationAccess(
  ctx: DbCtx,
  taskId: Id<"tasks">
): Promise<{
  task: Doc<"tasks">
  competitionId: Id<"competitions"> | null
}> {
  const principal = await requirePrincipal(ctx)
  const task = await ctx.db.get("tasks", taskId)
  if (task === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Task not found",
    })
  }

  const competitionId = await getCompetitionIdForTask(ctx, task)
  if (competitionId !== null) {
    const competition = await ctx.db.get("competitions", competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }
    requireCan(principal, "update", "Competition", competition)
    return { task, competitionId }
  }

  requireCan(principal, "manage", "Task")
  return { task, competitionId: null }
}

export async function authorizeTaskRun(
  ctx: AuthCtx,
  taskId: Id<"tasks">
): Promise<{
  task: Doc<"tasks">
  competitionId: Id<"competitions">
}> {
  const { task, competitionId } = await requireTaskIntegrationAccess(
    ctx,
    taskId
  )
  if (competitionId === null) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Task integrations require a competition-scoped task.",
    })
  }
  return { task, competitionId }
}

export const assertTaskIntegrationAccess = internalQuery({
  args: { integrationRowId: v.id("taskIntegrations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.integrationRowId)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    await requireTaskIntegrationAccess(ctx, row.taskId)
    return null
  },
})
