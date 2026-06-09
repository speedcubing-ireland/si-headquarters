import { ConvexError, v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { internalMutation, mutation } from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { requirePrincipal } from "@/convex/permissions/principal"
import { requireProjectForUpdate } from "@/convex/projects/access"
import {
  getProjectWorkflowDefinition,
  listProjectWorkflowDefinitions,
} from "@/convex/projectWorkflows/registry"
import {
  projectWorkflowConfig,
  projectWorkflowId,
  projectWorkflowResultStatus,
  projectWorkflowState,
  type ProjectWorkflowTrigger,
} from "@/convex/projectWorkflows/validators"

const MAX_WORKFLOW_RUNS_FOR_DELETE = 500
const MAX_DAILY_WORKFLOW_INSTALLATIONS = 100

export const install = mutation({
  args: {
    projectId: v.id("projects"),
    workflowId: projectWorkflowId,
    config: v.optional(projectWorkflowConfig),
  },
  returns: v.id("projectWorkflows"),
  handler: async (ctx, args) => {
    await requireProjectForUpdate(ctx, args.projectId)
    const definition = getProjectWorkflowDefinition(args.workflowId)
    const now = Date.now()
    const existing = await ctx.db
      .query("projectWorkflows")
      .withIndex("by_projectId_and_workflowId", (q) =>
        q.eq("projectId", args.projectId).eq("workflowId", args.workflowId)
      )
      .unique()
    if (existing !== null) {
      await ctx.db.patch("projectWorkflows", existing._id, {
        enabled: true,
        config: args.config ?? existing.config,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert("projectWorkflows", {
      projectId: args.projectId,
      workflowId: args.workflowId,
      enabled: true,
      config: args.config ?? definition.defaultConfig,
      state: null,
      installedAt: now,
      updatedAt: now,
    })
  },
})

export const remove = mutation({
  args: { id: v.id("projectWorkflows") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const installation = await ctx.db.get("projectWorkflows", args.id)
    if (installation === null) {
      return null
    }

    await requireProjectForUpdate(ctx, installation.projectId)
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_projectWorkflowId", (q) =>
        q.eq("projectWorkflowId", args.id)
      )
      .take(MAX_WORKFLOW_RUNS_FOR_DELETE + 1)

    if (runs.length > MAX_WORKFLOW_RUNS_FOR_DELETE) {
      throw new Error("Workflow has too many runs to delete at once.")
    }

    await Promise.all(runs.map((run) => ctx.db.delete("workflowRuns", run._id)))
    await ctx.db.delete("projectWorkflows", args.id)
    return null
  },
})

export const setEnabled = mutation({
  args: { id: v.id("projectWorkflows"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const installation = await ctx.db.get("projectWorkflows", args.id)
    if (installation === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Workflow installation not found",
      })
    }
    await requireProjectForUpdate(ctx, installation.projectId)
    await ctx.db.patch("projectWorkflows", args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const runNow = mutation({
  args: { id: v.id("projectWorkflows") },
  returns: v.id("workflowRuns"),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const installation = await ctx.db.get("projectWorkflows", args.id)
    if (installation === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Workflow installation not found",
      })
    }
    await requireProjectForUpdate(ctx, installation.projectId)
    return await queueRun(ctx, {
      projectWorkflowId: args.id,
      trigger: { type: "manual", actorId: principal.userId },
    })
  },
})

export const queueDailyRuns = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let queued = 0
    for (const definition of listProjectWorkflowDefinitions()) {
      if (definition.schedule.kind !== "daily") continue
      const installations = await ctx.db
        .query("projectWorkflows")
        .withIndex("by_workflowId_and_enabled", (q) =>
          q.eq("workflowId", definition.id).eq("enabled", true)
        )
        .take(MAX_DAILY_WORKFLOW_INSTALLATIONS + 1)
      if (installations.length > MAX_DAILY_WORKFLOW_INSTALLATIONS) {
        throw new Error("Too many workflow installations to queue at once.")
      }
      for (const installation of installations) {
        await queueRun(ctx, {
          projectWorkflowId: installation._id,
          trigger: { type: "daily" },
        })
        queued += 1
      }
    }
    return queued
  },
})

export const markRunStarted = internalMutation({
  args: { runId: v.id("workflowRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("workflowRuns", args.runId)
    if (run?.status !== "queued") return null
    await ctx.db.patch("workflowRuns", args.runId, {
      status: "running",
      startedAt: Date.now(),
    })
    return null
  },
})

export const applyRunResult = internalMutation({
  args: {
    runId: v.id("workflowRuns"),
    status: projectWorkflowResultStatus,
    summary: v.string(),
    state: v.optional(projectWorkflowState),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("workflowRuns", args.runId)
    if (run?.status !== "running") return null
    const now = Date.now()
    await ctx.db.patch("workflowRuns", args.runId, {
      status: args.status,
      completedAt: now,
      summary: args.summary,
      error: null,
    })
    if (args.state !== undefined) {
      await ctx.db.patch("projectWorkflows", run.projectWorkflowId, {
        state: args.state,
        updatedAt: now,
      })
    }
    if (args.status === "attention") {
      await scheduleNotificationEvent(ctx, {
        kind: "projectWorkflowAttention",
        projectId: run.projectId,
        workflowRunId: args.runId,
      })
    }
    return null
  },
})

export const applyRunError = internalMutation({
  args: { runId: v.id("workflowRuns"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("workflowRuns", args.runId)
    if (run?.status !== "running" && run?.status !== "queued") return null
    await ctx.db.patch("workflowRuns", args.runId, {
      status: "failed",
      completedAt: Date.now(),
      summary: "Workflow failed.",
      error: args.error,
    })
    return null
  },
})

async function queueRun(
  ctx: MutationCtx,
  args: {
    projectWorkflowId: Id<"projectWorkflows">
    trigger: ProjectWorkflowTrigger
  }
) {
  const installation = await ctx.db.get(
    "projectWorkflows",
    args.projectWorkflowId
  )
  if (installation === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Workflow installation not found",
    })
  }
  if (!installation.enabled) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Workflow is disabled.",
    })
  }
  const runId = await ctx.db.insert("workflowRuns", {
    projectWorkflowId: installation._id,
    projectId: installation.projectId,
    workflowId: installation.workflowId,
    trigger: args.trigger,
    status: "queued",
    queuedAt: Date.now(),
    startedAt: null,
    completedAt: null,
    summary: null,
    error: null,
  })
  await ctx.scheduler.runAfter(
    0,
    internal.projectWorkflows.runner.runProjectWorkflow,
    { runId }
  )
  return runId
}
