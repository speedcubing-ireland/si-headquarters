import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalMutation, mutation, query } from "@/convex/_generated/server"
import { authorizeTaskRun, requireTaskIntegrationAccess } from "@/convex/plugins/core/authorize"
import {
  taskIntegrationId,
  taskIntegrationDefinitionMeta,
  taskIntegrationOutput,
  taskIntegrationRow,
  taskIntegrationRunInput,
  taskIntegrationStatus,
} from "@/convex/plugins/core/validators"
import {
  getIntegrationDefinition,
  listIntegrationDefinitions,
} from "@/convex/plugins/core/resolvePlugins"
import { insertTaskIntegrationIfMissing } from "@/convex/plugins/core/taskIntegrationRows"

export const listDefinitions = query({
  args: {},
  returns: v.array(taskIntegrationDefinitionMeta),
  handler: () => {
    return listIntegrationDefinitions().map((definition) => ({
      id: definition.id,
      label: definition.label,
      pluginId: definition.pluginId,
    }))
  },
})

export const listAvailableForTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(taskIntegrationDefinitionMeta),
  handler: async (ctx, args) => {
    await requireTaskIntegrationAccess(ctx, args.taskId)
    const rows = await ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect()
    const attached = new Set(rows.map((row) => row.integrationId))
    return listIntegrationDefinitions()
      .filter((definition) => !attached.has(definition.id))
      .map((definition) => ({
        id: definition.id,
        label: definition.label,
        pluginId: definition.pluginId,
      }))
  },
})

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(taskIntegrationRow),
  handler: async (ctx, args) => {
    await requireTaskIntegrationAccess(ctx, args.taskId)
    return await ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect()
  },
})

export const attach = mutation({
  args: {
    taskId: v.id("tasks"),
    integrationId: taskIntegrationId,
  },
  returns: v.id("taskIntegrations"),
  handler: async (ctx, args) => {
    await requireTaskIntegrationAccess(ctx, args.taskId)
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

    await ctx.scheduler.runAfter(0, internal.plugins.core.runner.runIntegration, {
      integrationRowId: args.id,
      runId,
      input: args.input ?? {},
    })
    return null
  },
})

const manualConfirmStatus = v.union(
  v.literal("awaiting_manual_share"),
  v.literal("awaiting_manual_events_confirmation")
)

export const confirmManualStep = mutation({
  args: {
    id: v.id("taskIntegrations"),
    expectedStatus: manualConfirmStatus,
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
