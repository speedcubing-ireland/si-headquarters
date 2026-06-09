import { ConvexError, v } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { mutation, query } from "@/convex/_generated/server"
import {
  requireScopedObjectForRead,
  requireScopedObjectForUpdate,
} from "@/convex/access/scopedObject"
import { objectLinkedResourceRow } from "@/convex/integrations/validators"
import type { LinkedResourceType } from "@/convex/integrations/validators"
import {
  competitionOrProjectRef,
  type CompetitionOrProjectRef,
} from "@/convex/utils"

const RESOURCE_LABELS = {
  googleSheet: "Google Sheet",
  wcaCompetition: "WCA competition",
  discordChannel: "Discord channel",
} as const satisfies Record<LinkedResourceType, string>

export const listForObject = query({
  args: { object: competitionOrProjectRef },
  returns: v.array(objectLinkedResourceRow),
  handler: async (ctx, args) => {
    await requireScopedObjectForRead(ctx, args.object)
    return await ctx.db
      .query("objectLinkedResources")
      .withIndex("by_object_type_and_object_id", (q) =>
        q.eq("object.type", args.object.type).eq("object.id", args.object.id)
      )
      .collect()
  },
})

export const removeResource = mutation({
  args: { id: v.id("objectLinkedResources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resource = await ctx.db.get("objectLinkedResources", args.id)
    if (resource === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Linked resource not found",
      })
    }
    await requireScopedObjectForUpdate(ctx, resource.object)
    await ctx.db.delete("objectLinkedResources", args.id)
    return null
  },
})

export async function getRequiredObjectResource(
  ctx: { db: QueryCtx["db"] },
  object: CompetitionOrProjectRef,
  resourceType: LinkedResourceType,
  resourceKey: string
): Promise<Doc<"objectLinkedResources">> {
  const resource = await ctx.db
    .query("objectLinkedResources")
    .withIndex(
      "by_object_type_and_object_id_and_resourceType_and_resourceKey",
      (q) =>
        q
          .eq("object.type", object.type)
          .eq("object.id", object.id)
          .eq("resourceType", resourceType)
          .eq("resourceKey", resourceKey)
    )
    .unique()

  if (resource === null) {
    const label = RESOURCE_LABELS[resourceType]
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Link a ${label} to this ${object.type === "projects" ? "project" : "competition"} before running this integration.`,
    })
  }
  return resource
}

export async function getLinkedDiscordChannelTarget(
  ctx: { db: QueryCtx["db"] },
  object: CompetitionOrProjectRef
): Promise<{ kind: "discordChannel"; channelId: string } | null> {
  const resource = await ctx.db
    .query("objectLinkedResources")
    .withIndex(
      "by_object_type_and_object_id_and_resourceType_and_resourceKey",
      (q) =>
        q
          .eq("object.type", object.type)
          .eq("object.id", object.id)
          .eq("resourceType", "discordChannel")
          .eq("resourceKey", "default")
    )
    .unique()
  return resource?.data.resourceType === "discordChannel"
    ? { kind: "discordChannel", channelId: resource.data.channelId }
    : null
}
