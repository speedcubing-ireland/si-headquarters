import { ConvexError, v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import {
  competitionResourceData,
  competitionResourceType,
} from "@/convex/plugins/core/validators"

export const upsertResource = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    resourceType: competitionResourceType,
    resourceKey: v.string(),
    data: competitionResourceData,
  },
  returns: v.id("competitionLinkedResources"),
  handler: async (ctx, args) => {
    if (args.data.resourceType !== args.resourceType) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Resource data type does not match resourceType.",
      })
    }

    const existing = await ctx.db
      .query("competitionLinkedResources")
      .withIndex("by_competitionId_and_resourceType_and_resourceKey", (q) =>
        q
          .eq("competitionId", args.competitionId)
          .eq("resourceType", args.resourceType)
          .eq("resourceKey", args.resourceKey)
      )
      .unique()

    const row = {
      competitionId: args.competitionId,
      resourceType: args.resourceType,
      resourceKey: args.resourceKey,
      data: args.data,
    }

    let resourceId
    if (existing !== null) {
      await ctx.db.patch("competitionLinkedResources", existing._id, row)
      resourceId = existing._id
    } else {
      resourceId = await ctx.db.insert("competitionLinkedResources", row)
    }

    return resourceId
  },
})
