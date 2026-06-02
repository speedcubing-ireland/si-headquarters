import { v } from "convex/values"
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
    await ctx.db.patch("taskIntegrations", args.integrationRowId, {
      status: "awaiting_manual_share",
      lastMessage: `Linked "${args.title}". Share it in Canva, then confirm here.`,
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
