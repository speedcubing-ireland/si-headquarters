import type { Doc, Id } from "@/convex/_generated/dataModel"
import { isProxyAuctionFramework } from "@/convex/plugins/sponsor/lib/sponsorTypes"

export type SponsorBidStatus =
  | "winning"
  | "not_winning"
  | "winner"
  | "not_winner"
  | "bid_submitted"
  | "no_bid_submitted"

type AuctionSlice = Pick<
  Doc<"sponsorshipAuctions">,
  "framework" | "state" | "currentLeaderSponsorId" | "winnerSponsorId"
>

export function resolveSponsorBidStatus(input: {
  auction: AuctionSlice
  sponsorId: Id<"sponsors">
  hasSponsorValidBid: boolean
}): SponsorBidStatus | undefined {
  const { auction, sponsorId, hasSponsorValidBid } = input

  if (auction.state !== "active" && auction.state !== "closed") {
    return undefined
  }

  if (isProxyAuctionFramework(auction.framework)) {
    return resolveProxyBidStatus(auction, sponsorId)
  }

  return resolveSealedBidStatus(auction, sponsorId, hasSponsorValidBid)
}

function resolveProxyBidStatus(
  auction: AuctionSlice,
  sponsorId: Id<"sponsors">
): SponsorBidStatus {
  if (auction.state === "active") {
    return auction.currentLeaderSponsorId === sponsorId
      ? "winning"
      : "not_winning"
  }

  return auction.winnerSponsorId === sponsorId ? "winner" : "not_winner"
}

function resolveSealedBidStatus(
  auction: AuctionSlice,
  sponsorId: Id<"sponsors">,
  hasSponsorValidBid: boolean
): SponsorBidStatus {
  if (auction.state === "active") {
    return hasSponsorValidBid ? "bid_submitted" : "no_bid_submitted"
  }

  if (!hasSponsorValidBid) {
    return "no_bid_submitted"
  }

  return auction.winnerSponsorId === sponsorId ? "winner" : "not_winner"
}
