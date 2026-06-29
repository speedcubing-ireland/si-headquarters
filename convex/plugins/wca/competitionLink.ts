import { v } from "convex/values"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import { upsertObjectLinkedResource } from "@/convex/integrations/objectResourcesModel"
import { internalMutation } from "@/convex/_generated/server"

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
