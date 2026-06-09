import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requirePrincipal } from "@/convex/permissions/principal"
import { requireProjectForRead } from "@/convex/projects/access"
import {
  getProjectWorkflowDefinition,
  listProjectWorkflowDefinitions,
  toProjectWorkflowDefinitionMeta,
} from "@/convex/projectWorkflows/registry"
import {
  projectWorkflowDefinitionMeta,
  projectWorkflowRow,
  projectWorkflowRunRow,
} from "@/convex/projectWorkflows/validators"

export const listDefinitions = query({
  args: {},
  returns: v.array(projectWorkflowDefinitionMeta),
  handler: async (ctx) => {
    await requirePrincipal(ctx)
    return listProjectWorkflowDefinitions().map(toProjectWorkflowDefinitionMeta)
  },
})

export const listForProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(projectWorkflowRow),
  handler: async (ctx, args) => {
    await requireProjectForRead(ctx, args.projectId)
    const rows = await ctx.db
      .query("projectWorkflows")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect()
    return rows.map((row) => ({
      ...row,
      definition: toProjectWorkflowDefinitionMeta(
        getProjectWorkflowDefinition(row.workflowId)
      ),
    }))
  },
})

export const listRuns = query({
  args: { projectWorkflowId: v.id("projectWorkflows") },
  returns: v.array(projectWorkflowRunRow),
  handler: async (ctx, args) => {
    const installation = await ctx.db.get(
      "projectWorkflows",
      args.projectWorkflowId
    )
    if (installation === null) return []
    await requireProjectForRead(ctx, installation.projectId)
    return await ctx.db
      .query("workflowRuns")
      .withIndex("by_projectWorkflowId_and_queuedAt", (q) =>
        q.eq("projectWorkflowId", args.projectWorkflowId)
      )
      .take(20)
  },
})
