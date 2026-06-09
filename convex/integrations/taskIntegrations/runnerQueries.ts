import { ConvexError, v } from "convex/values"
import { internalQuery } from "@/convex/_generated/server"
import { getRequiredObjectResource } from "@/convex/integrations/objectResources"
import { getIntegrationDefinition } from "@/convex/integrations/taskIntegrations/registry"
import { loadedRunContext } from "@/convex/integrations/taskIntegrations/validators"
export { requireRunResource } from "@/convex/integrations/taskIntegrations/runResource"
import type { LinkedResourceData } from "@/convex/integrations/validators"
import { requireCompetitionScopedTask } from "@/convex/tasks/hierarchy"

export const loadRunContext = internalQuery({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    runId: v.string(),
  },
  returns: loadedRunContext,
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.integrationRowId)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    if (row.runId !== args.runId) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Integration run is stale.",
      })
    }

    const task = await ctx.db.get("tasks", row.taskId)
    if (task === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task not found",
      })
    }

    const competitionId = requireCompetitionScopedTask(task)

    const competition = await ctx.db.get("competitions", competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }

    const definition = getIntegrationDefinition(row.integrationId)
    const resources: Record<string, LinkedResourceData> = {}

    for (const required of definition.requiredResources) {
      const linked = await getRequiredObjectResource(
        ctx,
        {
          type: "competitions",
          id: competitionId,
        },
        required.resourceType,
        required.resourceKey
      )
      resources[`${required.resourceType}:${required.resourceKey}`] =
        linked.data
    }

    return {
      integrationId: row.integrationId,
      competitionId,
      competitionName: competition.name,
      resources,
    }
  },
})
