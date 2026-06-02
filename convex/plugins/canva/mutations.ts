import { ConvexError, v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
export const applyLinkedCanvaDesign = internalMutation({
  args: {
    integrationRowId: v.id("taskIntegrations"),
    designId: v.string(),
    designUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    void args.title
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
        thumbnailUrl: args.thumbnailUrl,
      },
    })
    return null
  },
})
