import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireTaskIntegrationAccess } from "@/convex/access/authorize"
import {
  getIntegrationDefinition,
  listIntegrationDefinitions,
  toIntegrationDefinitionMeta,
} from "@/convex/integrations/taskIntegrations/registry"
import {
  taskIntegrationDefinitionMeta,
  taskIntegrationListRow,
} from "@/convex/integrations/taskIntegrations/validators"
import { getCompetitionIdForTask } from "@/convex/tasks/hierarchy"

export const listAvailableForTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(taskIntegrationDefinitionMeta),
  handler: async (ctx, args) => {
    const { task } = await requireTaskIntegrationAccess(ctx, args.taskId)
    if (getCompetitionIdForTask(task) === null) {
      return []
    }
    const rows = await ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect()
    const attached = new Set(rows.map((row) => row.integrationId))
    return listIntegrationDefinitions()
      .filter((definition) => !attached.has(definition.id))
      .map(toIntegrationDefinitionMeta)
  },
})

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(taskIntegrationListRow),
  handler: async (ctx, args) => {
    await requireTaskIntegrationAccess(ctx, args.taskId)
    const rows = await ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect()
    return rows.map((row) => ({
      ...row,
      definition: toIntegrationDefinitionMeta(
        getIntegrationDefinition(row.integrationId)
      ),
    }))
  },
})
