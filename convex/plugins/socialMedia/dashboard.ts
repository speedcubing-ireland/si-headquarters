"use node"

import { v, type Infer } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { fetchFutureCompetitionDetails } from "@/convex/plugins/socialMedia/lib/fetchFromWca"
import type { HqLink } from "@/convex/plugins/socialMedia/resolveHqLinks"

const dashboardCompetitionValidator = v.object({
  wcaCompetitionId: v.string(),
  name: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  venue: v.string(),
  address: v.string(),
  eventIds: v.array(v.string()),
  competitorLimit: v.union(v.number(), v.null()),
  registrationOpen: v.union(v.string(), v.null()),
  sponsorLabels: v.array(v.string()),
  wcaUrl: v.string(),
  hqCompetitionId: v.optional(v.id("competitions")),
})

type DashboardCompetition = Infer<typeof dashboardCompetitionValidator>

export const fetchCompetitions = action({
  args: {},
  returns: v.array(dashboardCompetitionValidator),
  handler: async (ctx): Promise<DashboardCompetition[]> => {
    await ctx.runQuery(
      internal.permissions.queries.assertSocialMediaDashboardAccess,
      {}
    )

    const accessToken = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )

    const wcaCompetitions = await fetchFutureCompetitionDetails(accessToken)
    const hqLinks: HqLink[] = await ctx.runQuery(
      internal.plugins.socialMedia.resolveHqLinks.resolve,
      {
        wcaCompetitionIds: wcaCompetitions.map(
          (competition) => competition.wcaCompetitionId
        ),
      }
    )

    const linkByWcaId = new Map<string, HqLink>(
      hqLinks.map((link) => [link.wcaCompetitionId, link])
    )

    return wcaCompetitions.map((competition): DashboardCompetition => {
      const hqLink = linkByWcaId.get(competition.wcaCompetitionId)
      return {
        ...competition,
        ...(hqLink ? { hqCompetitionId: hqLink.competitionId } : {}),
      }
    })
  },
})
