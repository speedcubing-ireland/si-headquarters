import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { buildSponsorSponsorshipListItems } from "../lib/sponsorOwnedCompetitions"
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
    const auctionDocs = await listInvitedVisibleAuctions(ctx, sponsor._id)
    const competitionIds = [
      ...new Set(auctionDocs.map((auction) => auction.competitionId)),
    ]
    const competitions = await Promise.all(
      competitionIds.map((competitionId) =>
        ctx.db.get("competitions", competitionId)
      )
    )
    const competitionsById = new Map<Id<"competitions">, Doc<"competitions">>()
    for (const competition of competitions) {
      if (!competition) continue
      competitionsById.set(competition._id, competition)
    }

    return buildSponsorSponsorshipListItems({
      sponsorId: sponsor._id,
      auctions: auctionDocs,
      competitionsById,
    })
  },
})
