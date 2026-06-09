import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation } from "@/convex/_generated/server"
import {
  authorizeTaskRun,
  requireTaskIntegrationAccess,
} from "@/convex/access/authorize"
import { getIntegrationDefinition } from "@/convex/integrations/taskIntegrations/registry"
import type { TaskIntegrationId } from "@/convex/integrations/taskIntegrations/validators"
import { requireCompetitionScopedTask } from "@/convex/tasks/hierarchy"
import {
  manualTaskIntegrationStatus,
  taskIntegrationId,
  taskIntegrationOutput,
  taskIntegrationRunInput,
  taskIntegrationStatus,
} from "@/convex/integrations/taskIntegrations/validators"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"

export async function insertTaskIntegrationIfMissing(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  integrationId: TaskIntegrationId
): Promise<Id<"taskIntegrations">> {
  const existing = await ctx.db
    .query("taskIntegrations")
    .withIndex("by_taskId_and_integrationId", (q) =>
      q.eq("taskId", taskId).eq("integrationId", integrationId)
    )
    .unique()

  if (existing !== null) {
    return existing._id
  }

  return await ctx.db.insert("taskIntegrations", {
    taskId,
    integrationId,
    status: "idle",
    lastMessage: null,
    lastRunAt: null,
    runId: null,
    output: null,
  })
}

export const attach = mutation({
  args: {
    taskId: v.id("tasks"),
    integrationId: taskIntegrationId,
  },
  returns: v.id("taskIntegrations"),
  handler: async (ctx, args) => {
    const { task } = await requireTaskIntegrationAccess(ctx, args.taskId)
    requireCompetitionScopedTask(task)
    getIntegrationDefinition(args.integrationId)
    return await insertTaskIntegrationIfMissing(
      ctx,
      args.taskId,
      args.integrationId
    )
  },
})

export const detach = mutation({
  args: { id: v.id("taskIntegrations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.id)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    await requireTaskIntegrationAccess(ctx, row.taskId)
    await ctx.db.delete("taskIntegrations", args.id)
    return null
  },
})

export const run = mutation({
  args: {
    id: v.id("taskIntegrations"),
    input: v.optional(taskIntegrationRunInput),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.id)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    await authorizeTaskRun(ctx, row.taskId)

    if (row.status === "running") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Integration is already running.",
      })
    }

    const runId = crypto.randomUUID()

    await ctx.db.patch("taskIntegrations", args.id, {
      status: "running",
      lastMessage: null,
      lastRunAt: Date.now(),
      runId,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.integrations.taskIntegrations.runner.runIntegration,
      {
        integrationRowId: args.id,
        runId,
        input: args.input ?? {},
      }
    )
    return null
  },
})

export const confirmManualStep = mutation({
  args: {
    id: v.id("taskIntegrations"),
    expectedStatus: manualTaskIntegrationStatus,
    completedMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.id)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    await requireTaskIntegrationAccess(ctx, row.taskId)
    if (row.status === "completed") {
      return null
    }
    if (row.status !== args.expectedStatus) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Integration is not awaiting status '${args.expectedStatus}'.`,
      })
    }
    await ctx.db.patch("taskIntegrations", args.id, {
      status: "completed",
      lastMessage: args.completedMessage,
      runId: null,
    })
    return null
  },
})

export const applyRunResult = internalMutation({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    runId: v.string(),
    status: taskIntegrationStatus,
    lastMessage: v.union(v.string(), v.null()),
    output: taskIntegrationOutput,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.integrationRowId)
    if (row?.runId !== args.runId) {
      return null
    }
    await ctx.db.patch("taskIntegrations", args.integrationRowId, {
      status: args.status,
      lastMessage: args.lastMessage,
      lastRunAt: Date.now(),
      output: args.output,
      runId: null,
    })
    return null
  },
})
