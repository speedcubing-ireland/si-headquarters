import { ConvexError, v } from "convex/values"
import { internalMutation, internalQuery } from "@/convex/_generated/server"
import { requireTaskIntegrationAccess } from "@/convex/access/authorize"

export const loadDesignForThumbnailRefresh = internalQuery({
  args: { integrationRowId: v.id("taskIntegrations") },
  returns: v.union(v.object({ designId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.integrationRowId)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    await requireTaskIntegrationAccess(ctx, row.taskId)
    if (row.output?.kind !== "canva_design") return null
    return { designId: row.output.designId }
  },
})

export const applyLinkedCanvaDesign = internalMutation({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    designId: v.string(),
    designUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("taskIntegrations", args.integrationRowId)
    if (row === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Task integration not found",
      })
    }
    if (row.status === "running") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot link a design while the integration is running.",
      })
    }

    await ctx.db.patch("taskIntegrations", args.integrationRowId, {
      status: "awaiting_manual_share",
      lastMessage: null,
      lastRunAt: Date.now(),
      runId: null,
      output: {
        kind: "canva_design",
        designId: args.designId,
        designUrl: args.designUrl,
      },
    })
    return null
  },
})
