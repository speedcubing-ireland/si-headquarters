import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { Infer } from "convex/values"
import { buildCompetitionRecordSummary } from "@/convex/plugins/sponsor/lib/competitionSnapshot"
import {
  compareSponsorshipLifecycle,
  resolveSponsorshipLifecycle,
} from "@/convex/plugins/sponsor/lib/sponsorshipLifecycle"
import type { sponsorSponsorshipListItem } from "@/convex/plugins/sponsor/portal/shared"

export type SponsorSponsorshipListItem = Infer<
  typeof sponsorSponsorshipListItem
>

export function sponsorOwnsCompetition(input: {
  sponsorId: Id<"sponsors">
  competition: Pick<Doc<"competitions">, "manualSponsorId">
  auctions: Pick<Doc<"sponsorshipAuctions">, "state" | "winnerSponsorId">[]
}): boolean {
  if (input.competition.manualSponsorId === input.sponsorId) {
    return true
  }
  return input.auctions.some(
    (auction) =>
      auction.state === "closed" && auction.winnerSponsorId === input.sponsorId
  )
}

function pickManagementAuction(
  auctions: Doc<"sponsorshipAuctions">[],
  sponsorId: Id<"sponsors">
): Doc<"sponsorshipAuctions"> {
  const closedWin = auctions.find(
    (auction) =>
      auction.state === "closed" && auction.winnerSponsorId === sponsorId
  )
  if (closedWin) return closedWin
  return [...auctions].sort((a, b) => b.endsAt - a.endsAt)[0]
}

export function buildSponsorSponsorshipListItems(input: {
  sponsorId: Id<"sponsors">
  auctions: Doc<"sponsorshipAuctions">[]
  competitionsById: Map<Id<"competitions">, Doc<"competitions">>
  now?: number
}): SponsorSponsorshipListItem[] {
  const auctionsByCompetition = new Map<
    Id<"competitions">,
    Doc<"sponsorshipAuctions">[]
  >()
  for (const auction of input.auctions) {
    const existing = auctionsByCompetition.get(auction.competitionId) ?? []
    existing.push(auction)
    auctionsByCompetition.set(auction.competitionId, existing)
  }

  const items: SponsorSponsorshipListItem[] = []

  for (const [competitionId, competitionAuctions] of auctionsByCompetition) {
    const competition = input.competitionsById.get(competitionId)
    if (!competition) continue
    if (
      !sponsorOwnsCompetition({
        sponsorId: input.sponsorId,
        competition,
        auctions: competitionAuctions,
      })
    ) {
      continue
    }

    const managementAuction = pickManagementAuction(
      competitionAuctions,
      input.sponsorId
    )
    const competitionName = competition.name
    const competitionSummary =
      managementAuction.competitionSnapshot?.summary ??
      buildCompetitionRecordSummary({
        name: competitionName,
        compDates: competition.compDates,
      })
    const competitionSummarySource =
      managementAuction.competitionSnapshot?.source ?? "competition_record"
    const lifecycle = resolveSponsorshipLifecycle({
      startDate: competitionSummary.startDate,
      endDate: competitionSummary.endDate,
      now: input.now,
    })
    const wonAuction = competitionAuctions.some(
      (auction) =>
        auction.state === "closed" &&
        auction.winnerSponsorId === input.sponsorId
    )
    const acquiredVia = wonAuction ? "auction_win" : "manual_assignment"

    items.push({
      competitionId,
      competitionName,
      competitionSummary,
      competitionSummarySource,
      lifecycle,
      managementAuctionId: managementAuction._id,
      acquiredVia,
    })
  }

  return sortSponsorSponsorshipListItems(items)
}

export function sortSponsorSponsorshipListItems(
  items: SponsorSponsorshipListItem[]
): SponsorSponsorshipListItem[] {
  return [...items].sort((left, right) => {
    const lifecycleOrder = compareSponsorshipLifecycle(
      left.lifecycle,
      right.lifecycle
    )
    if (lifecycleOrder !== 0) return lifecycleOrder

    const leftStart = left.competitionSummary.startDate
    const rightStart = right.competitionSummary.startDate
    if (left.lifecycle === "completed") {
      return right.competitionSummary.endDate.localeCompare(
        left.competitionSummary.endDate
      )
    }
    return leftStart.localeCompare(rightStart)
  })
}
