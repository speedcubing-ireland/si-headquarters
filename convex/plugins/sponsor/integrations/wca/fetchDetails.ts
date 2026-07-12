"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction } from "@/convex/_generated/server"
import {
  fetchCompetitionDetails,
  sponsorshipWcaCompetitionDetails,
  type SponsorshipWcaCompetitionDetails,
} from "@/convex/plugins/sponsor/integrations/wca/competitionDetails"

export const fetchCompetitionDetailsInternal = internalAction({
  args: { wcaCompetitionId: v.string() },
  returns: v.union(sponsorshipWcaCompetitionDetails, v.null()),
  handler: async (
    ctx,
    args
  ): Promise<SponsorshipWcaCompetitionDetails | null> => {
    const accessToken: string = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )
    return fetchCompetitionDetails(accessToken, args.wcaCompetitionId)
  },
})
