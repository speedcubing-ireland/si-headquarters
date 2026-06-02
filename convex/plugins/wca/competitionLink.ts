import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"

export const patchCompetitionWcaId = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    wcaCompetitionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("competitions", args.competitionId, {
      wcaCompetitionId: args.wcaCompetitionId,
    })
    return null
  },
})
