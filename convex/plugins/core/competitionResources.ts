import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { mutation, query } from "@/convex/_generated/server"
import {
  requireCompetitionForRead,
  requireCompetitionForUpdate,
} from "@/convex/plugins/core/authorize"
import { competitionLinkedResourceRow } from "@/convex/plugins/core/validators"
import type { CompetitionResourceType } from "@/convex/plugins/core/types"

export const listForCompetition = query({
  args: { competitionId: v.id("competitions") },
  returns: v.array(competitionLinkedResourceRow),
  handler: async (ctx, args) => {
    await requireCompetitionForRead(ctx, args.competitionId)
    return await ctx.db
      .query("competitionLinkedResources")
      .withIndex("by_competitionId_and_resourceType", (q) =>
        q.eq("competitionId", args.competitionId)
      )
      .collect()
  },
})

export const removeResource = mutation({
  args: { id: v.id("competitionLinkedResources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resource = await ctx.db.get("competitionLinkedResources", args.id)
    if (resource === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Linked resource not found",
      })
    }
    await requireCompetitionForUpdate(ctx, resource.competitionId)
    await ctx.db.delete("competitionLinkedResources", args.id)
    return null
  },
})

export async function getRequiredResource(
  ctx: { db: QueryCtx["db"] },
  competitionId: Id<"competitions">,
  resourceType: CompetitionResourceType,
  resourceKey: string
): Promise<Doc<"competitionLinkedResources">> {
  const resource = await ctx.db
    .query("competitionLinkedResources")
    .withIndex("by_competitionId_and_resourceType_and_resourceKey", (q) =>
      q
        .eq("competitionId", competitionId)
        .eq("resourceType", resourceType)
        .eq("resourceKey", resourceKey)
    )
    .unique()

  if (resource === null) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Missing ${resourceType} resource '${resourceKey}' for this competition.`,
    })
  }
  return resource
}
