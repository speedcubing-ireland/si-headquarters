import { v } from "convex/values"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import { upsertObjectLinkedResource } from "@/convex/integrations/objectResourcesModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"

export const saveCompetitionLink = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    wcaCompetitionId: v.string(),
    name: v.string(),
    url: v.string(),
  },
  returns: v.id("objectLinkedResources"),
  handler: async (ctx, args) => {
    const resourceId = await upsertObjectLinkedResource(ctx, {
      object: { type: "competitions", id: args.competitionId },
      resourceType: "wcaCompetition",
      resourceKey: DEFAULT_RESOURCE_KEYS.wcaCompetition,
      data: {
        resourceType: "wcaCompetition",
        wcaCompetitionId: args.wcaCompetitionId,
        name: args.name,
        url: args.url,
      },
    })
    await ctx.db.patch("competitions", args.competitionId, {
      wcaCompetitionId: args.wcaCompetitionId,
    })
    return resourceId
  },
})

export async function unlinkCompetitionIfWcaLinkMatches(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  expectedWcaCompetitionId: string
): Promise<Doc<"competitions"> | null> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (
    competition === null ||
    competition.wcaCompetitionId !== expectedWcaCompetitionId
  ) {
    return null
  }

  const linkedResource = await ctx.db
    .query("objectLinkedResources")
    .withIndex(
      "by_object_type_and_object_id_and_resourceType_and_resourceKey",
      (q) =>
        q
          .eq("object.type", "competitions")
          .eq("object.id", competitionId)
          .eq("resourceType", "wcaCompetition")
          .eq("resourceKey", DEFAULT_RESOURCE_KEYS.wcaCompetition)
    )
    .unique()

  if (
    linkedResource !== null &&
    (linkedResource.data.resourceType !== "wcaCompetition" ||
      linkedResource.data.wcaCompetitionId !== expectedWcaCompetitionId)
  ) {
    return null
  }

  if (linkedResource !== null) {
    await ctx.db.delete("objectLinkedResources", linkedResource._id)
  }
  await ctx.db.patch("competitions", competitionId, {
    wcaCompetitionId: undefined,
    // `cancelledAt` means "the WCA says this is cancelled", so it cannot
    // outlive the link. Left set, it would hide the competition from the
    // dashboard with no WCA row left in the UI to clear it from.
    cancelledAt: undefined,
  })
  return competition
}
