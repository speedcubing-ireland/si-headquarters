import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { internalQuery } from "@/convex/_generated/server"
import { requireScopedObjectForUpdate } from "@/convex/access/scopedObject"
import { requireCompetitionForUpdate } from "@/convex/competitions/access"
import {
  requireCan,
  requireDirector,
  requirePrincipal,
} from "@/convex/permissions/principal"
import { requireProjectForUpdate } from "@/convex/projects/access"
import { requireCompetitionScopedTask } from "@/convex/tasks/hierarchy"
import { competitionOrProjectRef } from "@/convex/utils"

type AuthCtx = QueryCtx | MutationCtx
type DbCtx = QueryCtx | MutationCtx

export const assertDirectorAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireDirector(ctx)
    return null
  },
})

export const assertCompetitionUpdateAccess = internalQuery({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, args) => {
    await requireCompetitionForUpdate(ctx, args.competitionId)
    return null
  },
})

export const assertObjectUpdateAccess = internalQuery({
  args: { object: competitionOrProjectRef },
  handler: async (ctx, args) => {
    await requireScopedObjectForUpdate(ctx, args.object)
    return null
  },
})

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

  switch (task.root.type) {
    case "competitions": {
      const competition = await ctx.db.get("competitions", task.root.id)
      if (competition === null) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Competition not found",
        })
      }
      requireCan(principal, "update", "Competition", competition)
      return { task, competitionId: task.root.id }
    }
    case "projects":
      await requireProjectForUpdate(ctx, task.root.id)
      return { task, competitionId: null }
  }
}

export async function authorizeTaskRun(
  ctx: AuthCtx,
  taskId: Id<"tasks">
): Promise<{
  task: Doc<"tasks">
  competitionId: Id<"competitions">
}> {
  const { task } = await requireTaskIntegrationAccess(ctx, taskId)
  return { task, competitionId: requireCompetitionScopedTask(task) }
}

export const assertTaskIntegrationAccess = internalQuery({
  args: { integrationRowId: v.id("taskIntegrations") },
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
