import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { Infer } from "convex/values"
import type { competitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/validators"

export type CompetitionSponsorPropertyStatus = Infer<
  typeof competitionSponsorPropertyStatus
>

type CompetitionSponsorOverrideFields = Partial<
  Pick<
    Doc<"competitionSponsorOverrides">,
    "manualSponsorId" | "manualSponsorPropertyStatus"
  >
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
  override: CompetitionSponsorOverrideFields | null | undefined
  auctions: AuctionSponsorFields[]
}): CompetitionSponsorPropertyStatus {
  return resolveCompetitionSponsorStatus({
    auctionStates: input.auctions.map((auction) => auction.state),
    hasClosedWinner: input.auctions.some(
      (auction) =>
        auction.state === "closed" && auction.winnerSponsorId !== undefined
    ),
    manualSponsorId: input.override?.manualSponsorId,
    manualStatus: input.override?.manualSponsorPropertyStatus,
  })
}

export function buildCompetitionSponsorStatusByCompetition(input: {
  competitionIds: readonly Id<"competitions">[]
  auctions: (AuctionSponsorFields & { competitionId: Id<"competitions"> })[]
  overridesByCompetitionId: ReadonlyMap<
    Id<"competitions">,
    CompetitionSponsorOverrideFields | null
  >
}): Map<Id<"competitions">, CompetitionSponsorPropertyStatus> {
  const auctionsByCompetition = new Map<
    Id<"competitions">,
    AuctionSponsorFields[]
  >()
  for (const auction of input.auctions) {
    const scoped = auctionsByCompetition.get(auction.competitionId) ?? []
    scoped.push(auction)
    auctionsByCompetition.set(auction.competitionId, scoped)
  }

  const statusByCompetition = new Map<
    Id<"competitions">,
    CompetitionSponsorPropertyStatus
  >()
  for (const competitionId of input.competitionIds) {
    statusByCompetition.set(
      competitionId,
      resolveCompetitionSponsorPropertyStatus({
        override: input.overridesByCompetitionId.get(competitionId) ?? null,
        auctions: auctionsByCompetition.get(competitionId) ?? [],
      })
    )
  }
  return statusByCompetition
}

export function deriveCompetitionSponsorStatusFromAuctions(
  auctions: AuctionSponsorFields[]
): CompetitionSponsorPropertyStatus {
  return resolveCompetitionSponsorPropertyStatus({
    override: null,
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
  override: CompetitionSponsorOverrideFields | null | undefined
): boolean {
  return (
    override?.manualSponsorPropertyStatus !== undefined ||
    override?.manualSponsorId !== undefined
  )
}
