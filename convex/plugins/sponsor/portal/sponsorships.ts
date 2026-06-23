import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { buildSponsorSponsorshipListItems } from "../lib/sponsorOwnedCompetitions"
import {
  getCompetitionSponsorOverridesByCompetitionId,
  listCompetitionSponsorOverridesForSponsor,
} from "@/convex/plugins/sponsor/lib/competitionSponsorOverrides"
import {
  listInvitedVisibleAuctions,
  requireSponsorSession,
  sponsorSponsorshipListItem,
} from "./shared"

export const listMySponsorships = query({
  args: { sessionToken: v.string() },
  returns: v.array(sponsorSponsorshipListItem),
  handler: async (ctx, args) => {
    const { sponsor } = await requireSponsorSession(ctx, args.sessionToken)
    const [auctionDocs, manualOverrides] = await Promise.all([
      listInvitedVisibleAuctions(ctx, sponsor._id),
      listCompetitionSponsorOverridesForSponsor(ctx, sponsor._id),
    ])
    const competitionIds = [
      ...new Set(
        [
          ...auctionDocs.map((auction) => auction.competitionId),
          ...manualOverrides.map((override) => override.competitionId),
        ].filter((id): id is Id<"competitions"> => id !== undefined)
      ),
    ]
    const [competitions, overridesByCompetitionId] = await Promise.all([
      Promise.all(
        competitionIds.map((competitionId) =>
          ctx.db.get("competitions", competitionId)
        )
      ),
      getCompetitionSponsorOverridesByCompetitionId(ctx, competitionIds),
    ])
    const competitionsById = new Map<Id<"competitions">, Doc<"competitions">>()
    for (const competition of competitions) {
      if (!competition) continue
      competitionsById.set(competition._id, competition)
    }

    return buildSponsorSponsorshipListItems({
      sponsorId: sponsor._id,
      auctions: auctionDocs,
      competitionsById,
      overridesByCompetitionId,
    })
  },
})
