import { ConvexError, v } from "convex/values"
import { internalQuery } from "@/convex/_generated/server"
import { getRequiredResource } from "@/convex/plugins/core/competitionResources"
import { getCompetitionIdForTask } from "@/convex/tasks/blockers/competition"
import type { CompetitionResourceData } from "@/convex/plugins/core/types"
import { loadedRunContext } from "@/convex/plugins/core/validators"
import { getIntegrationDefinition } from "@/convex/plugins/core/resolvePlugins"

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

    const competitionId = await getCompetitionIdForTask(ctx, task)
    if (competitionId === null) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Task integrations require a competition-scoped task.",
      })
    }

    const competition = await ctx.db.get("competitions", competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }

    const definition = getIntegrationDefinition(row.integrationId)
    const resources: Record<string, CompetitionResourceData> = {}

    for (const required of definition.requiredResources) {
      const linked = await getRequiredResource(
        ctx,
        competitionId,
        required.resourceType,
        required.resourceKey
      )
      resources[`${required.resourceType}:${required.resourceKey}`] = linked.data
    }

    return {
      integrationId: row.integrationId,
      competitionId,
      competitionName: competition.name,
      resources,
    }
  },
})
