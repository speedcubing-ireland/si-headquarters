"use node"

import { v } from "convex/values"
import { internalAction } from "@/convex/_generated/server"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import {
  fetchCompetitionDetails,
  sponsorshipWcaCompetitionDetailsFetchResult,
  type SponsorshipWcaCompetitionDetailsFetchResult,
} from "@/convex/plugins/sponsor/integrations/wca/competitionDetails"

export const fetchCompetitionDetailsInternal = internalAction({
  args: { wcaCompetitionId: v.string() },
  returns: sponsorshipWcaCompetitionDetailsFetchResult,
  handler: async (
    ctx,
    args
  ): Promise<SponsorshipWcaCompetitionDetailsFetchResult> => {
    const accessToken = await resolveValidServiceToken(ctx, "wca")
    return fetchCompetitionDetails(accessToken, args.wcaCompetitionId)
  },
})
