import { ConvexError, v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  linkedResourceData,
  linkedResourceType,
  type LinkedResourceData,
  type LinkedResourceType,
} from "@/convex/integrations/validators"
import {
  competitionOrProjectRef,
  type CompetitionOrProjectRef,
} from "@/convex/utils"

export async function upsertObjectLinkedResource(
  ctx: Pick<MutationCtx, "db">,
  args: {
    object: CompetitionOrProjectRef
    resourceType: LinkedResourceType
    resourceKey: string
    data: LinkedResourceData
  }
): Promise<Id<"objectLinkedResources">> {
  const existing = await ctx.db
    .query("objectLinkedResources")
    .withIndex(
      "by_object_type_and_object_id_and_resourceType_and_resourceKey",
      (q) =>
        q
          .eq("object.type", args.object.type)
          .eq("object.id", args.object.id)
          .eq("resourceType", args.resourceType)
          .eq("resourceKey", args.resourceKey)
    )
    .unique()

  const row = {
    object: args.object,
    resourceType: args.resourceType,
    resourceKey: args.resourceKey,
    data: args.data,
  }

  if (existing !== null) {
    await ctx.db.patch("objectLinkedResources", existing._id, row)
    return existing._id
  }
  return await ctx.db.insert("objectLinkedResources", row)
}

export const upsertResource = internalMutation({
  args: {
    object: competitionOrProjectRef,
    resourceType: linkedResourceType,
    resourceKey: v.string(),
    data: linkedResourceData,
  },
  returns: v.id("objectLinkedResources"),
  handler: async (ctx, args) => {
    if (args.data.resourceType !== args.resourceType) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Resource data type does not match resourceType.",
      })
    }

    return await upsertObjectLinkedResource(ctx, args)
  },
})
