"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { getIntegrationDefinition } from "@/convex/integrations/taskIntegrations/registry"
import type { LoadedRunContext } from "@/convex/integrations/taskIntegrations/validators"
import type { TaskIntegrationRunResult } from "@/convex/integrations/taskIntegrations/pluginContract"
import { taskIntegrationRunInput } from "@/convex/integrations/taskIntegrations/validators"

export const runIntegration = internalAction({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    runId: v.string(),
    input: taskIntegrationRunInput,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let result: TaskIntegrationRunResult
    try {
      const runContext: LoadedRunContext = await ctx.runQuery(
        internal.integrations.taskIntegrations.runnerQueries.loadRunContext,
        {
          integrationRowId: args.integrationRowId,
          runId: args.runId,
        }
      )
      const definition = getIntegrationDefinition(runContext.integrationId)
      result = await definition.run(ctx, {
        competitionId: runContext.competitionId,
        competitionName: runContext.competitionName,
        integrationRowId: args.integrationRowId,
        integrationId: runContext.integrationId,
        resources: runContext.resources,
        input: args.input,
      })
    } catch (error) {
      result = {
        status: "error",
        lastMessage: unknownErrorMessage(error, { includeConvexError: true }),
        output: null,
      }
    }

    await ctx.runMutation(
      internal.integrations.taskIntegrations.mutations.applyRunResult,
      {
        integrationRowId: args.integrationRowId,
        runId: args.runId,
        status: result.status,
        lastMessage: result.lastMessage,
        output: result.output,
      }
    )
    return null
  },
})
