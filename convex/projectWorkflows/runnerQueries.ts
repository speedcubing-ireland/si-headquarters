import { ConvexError, v } from "convex/values"
import { internalQuery } from "@/convex/_generated/server"

export const loadRunContext = internalQuery({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("workflowRuns", args.runId)
    if (run === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Workflow run not found",
      })
    }
    const installation = await ctx.db.get(
      "projectWorkflows",
      run.projectWorkflowId
    )
    if (installation === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Workflow installation not found",
      })
    }
    const project = await ctx.db.get("projects", run.projectId)
    if (project === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Project not found",
      })
    }
    return { run, installation, project }
  },
})
