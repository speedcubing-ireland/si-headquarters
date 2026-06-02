import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { Infer } from "convex/values"
import type { competitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/validators"

export type CompetitionSponsorPropertyStatus = Infer<
  typeof competitionSponsorPropertyStatus
>

type CompetitionSponsorFields = Pick<
  Doc<"competitions">,
  "manualSponsorId" | "manualSponsorPropertyStatus"
>

type AuctionSponsorFields = Pick<
  Doc<"sponsorshipAuctions">,
  "state" | "winnerSponsorId"
>

export function resolveCompetitionSponsorStatus(input: {
  auctionStates: Doc<"sponsorshipAuctions">["state"][]
  hasClosedWinner: boolean
  manualSponsorId?: Id<"sponsors">
  manualStatus?: CompetitionSponsorPropertyStatus
}): CompetitionSponsorPropertyStatus {
  if (input.manualSponsorId !== undefined) {
    return "sponsor"
  }
  if (input.manualStatus !== undefined) {
    return input.manualStatus
  }
  if (input.auctionStates.length === 0) {
    return "not_offered"
  }
  if (input.auctionStates.some((state) => state !== "closed")) {
    return "bidding"
  }
  if (input.hasClosedWinner) {
    return "sponsor"
  }
  return "none"
}

export function resolveCompetitionSponsorPropertyStatus(input: {
  competition: CompetitionSponsorFields
  auctions: AuctionSponsorFields[]
}): CompetitionSponsorPropertyStatus {
  return resolveCompetitionSponsorStatus({
    auctionStates: input.auctions.map((auction) => auction.state),
    hasClosedWinner: input.auctions.some(
      (auction) =>
        auction.state === "closed" && auction.winnerSponsorId !== undefined
    ),
    manualSponsorId: input.competition.manualSponsorId,
    manualStatus: input.competition.manualSponsorPropertyStatus,
  })
}

export function deriveCompetitionSponsorStatusFromAuctions(
  auctions: AuctionSponsorFields[]
): CompetitionSponsorPropertyStatus {
  return resolveCompetitionSponsorPropertyStatus({
    competition: {},
    auctions,
  })
}

export function findWinningClosedAuction(
  auctions: Doc<"sponsorshipAuctions">[]
): Doc<"sponsorshipAuctions"> | undefined {
  return auctions.find(
    (auction) =>
      auction.state === "closed" && auction.winnerSponsorId !== undefined
  )
}

export function isCompetitionSponsorManualOverride(
  competition: CompetitionSponsorFields
): boolean {
  return (
    competition.manualSponsorPropertyStatus !== undefined ||
    competition.manualSponsorId !== undefined
  )
}
