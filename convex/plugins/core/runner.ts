"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { getIntegrationDefinition } from "@/convex/plugins/core/resolvePlugins"
import { taskIntegrationRunInput } from "@/convex/plugins/core/validators"
import type { LoadedRunContext } from "@/convex/plugins/core/validators"
import type { IntegrationRunResult } from "@/convex/plugins/integrationTypes"

export const runIntegration = internalAction({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    runId: v.string(),
    input: taskIntegrationRunInput,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const runContext: LoadedRunContext = await ctx.runQuery(
      internal.plugins.core.runnerQueries.loadRunContext,
      {
        integrationRowId: args.integrationRowId,
        runId: args.runId,
      }
    )

    const definition = getIntegrationDefinition(runContext.integrationId)

    let result: IntegrationRunResult
    try {
      result = await definition.run(ctx, {
        competitionId: runContext.competitionId,
        competitionName: runContext.competitionName,
        integrationRowId: args.integrationRowId,
        integrationId: runContext.integrationId,
        resources: runContext.resources,
        input: args.input,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result = {
        status: "error",
        lastMessage: message,
        output: null,
      }
    }

    await ctx.runMutation(internal.plugins.core.taskIntegrations.applyRunResult, {
      integrationRowId: args.integrationRowId,
      runId: args.runId,
      status: result.status,
      lastMessage: result.lastMessage,
      output: result.output,
    })
    return null
  },
})
