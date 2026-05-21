import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"

type SponsorshipCtx = MutationCtx | QueryCtx

export function groupAuctionsByCompetition(
  auctions: Doc<"sponsorshipAuctions">[]
): Map<Id<"competitions">, Doc<"sponsorshipAuctions">[]> {
  const auctionsByCompetition = new Map<
    Id<"competitions">,
    Doc<"sponsorshipAuctions">[]
  >()
  for (const auction of auctions) {
    const current = auctionsByCompetition.get(auction.competitionId) ?? []
    current.push(auction)
    auctionsByCompetition.set(auction.competitionId, current)
  }
  return auctionsByCompetition
}

export async function findAuctionInvite(
  ctx: SponsorshipCtx,
  auctionId: Id<"sponsorshipAuctions">,
  sponsorId: Id<"sponsors">
): Promise<Doc<"sponsorshipAuctionInvites"> | null> {
  return await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_auction_and_sponsor", (q) =>
      q.eq("auctionId", auctionId).eq("sponsorId", sponsorId)
    )
    .unique()
}

export async function listAuctionInvites(
  ctx: SponsorshipCtx,
  auctionId: Id<"sponsorshipAuctions">
): Promise<Doc<"sponsorshipAuctionInvites">[]> {
  return await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .collect()
}

export async function listAuctionIntents(
  ctx: SponsorshipCtx,
  auctionId: Id<"sponsorshipAuctions">
): Promise<Doc<"sponsorshipBidIntents">[]> {
  return await ctx.db
    .query("sponsorshipBidIntents")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .collect()
}

export async function listAuctionBidEvents(
  ctx: SponsorshipCtx,
  auctionId: Id<"sponsorshipAuctions">
): Promise<Doc<"sponsorshipBidEvents">[]> {
  return await ctx.db
    .query("sponsorshipBidEvents")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .collect()
}
