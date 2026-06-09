"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { getProjectWorkflowDefinition } from "@/convex/projectWorkflows/registry"

export const runProjectWorkflow = internalAction({
  args: { runId: v.id("workflowRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.projectWorkflows.mutations.markRunStarted, {
      runId: args.runId,
    })
    try {
      const { run, installation, project } = await ctx.runQuery(
        internal.projectWorkflows.runnerQueries.loadRunContext,
        { runId: args.runId }
      )
      const definition = getProjectWorkflowDefinition(run.workflowId)
      const result = await definition.run(ctx, {
        project,
        installation,
        trigger: run.trigger,
      })
      await ctx.runMutation(
        internal.projectWorkflows.mutations.applyRunResult,
        {
          runId: args.runId,
          status: result.status,
          summary: result.summary,
          state: result.state,
        }
      )
    } catch (error) {
      await ctx.runMutation(internal.projectWorkflows.mutations.applyRunError, {
        runId: args.runId,
        error: unknownErrorMessage(error, { includeConvexError: true }),
      })
    }
    return null
  },
})
