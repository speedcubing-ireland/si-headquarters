import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { Infer } from "convex/values"
import { resolveCompetitionSummaryView } from "@/convex/plugins/sponsor/lib/competitionSnapshot"
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
  override: Pick<Doc<"competitionSponsorOverrides">, "manualSponsorId"> | null
  auctions: Pick<Doc<"sponsorshipAuctions">, "state" | "winnerSponsorId">[]
}): boolean {
  if (input.override?.manualSponsorId === input.sponsorId) {
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
): Doc<"sponsorshipAuctions"> | undefined {
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
  overridesByCompetitionId: Map<
    Id<"competitions">,
    Doc<"competitionSponsorOverrides"> | null
  >
  now?: number
}): SponsorSponsorshipListItem[] {
  const auctionsByCompetition = new Map<
    Id<"competitions">,
    Doc<"sponsorshipAuctions">[]
  >()
  for (const auction of input.auctions) {
    if (
      auction.competitionId === undefined ||
      auction.subjectKind === "custom"
    ) {
      continue
    }
    const existing = auctionsByCompetition.get(auction.competitionId) ?? []
    existing.push(auction)
    auctionsByCompetition.set(auction.competitionId, existing)
  }

  const items: SponsorSponsorshipListItem[] = []
  const competitionIds = new Set([
    ...auctionsByCompetition.keys(),
    ...input.overridesByCompetitionId.keys(),
  ])

  for (const competitionId of competitionIds) {
    const competitionAuctions = auctionsByCompetition.get(competitionId) ?? []
    const competition = input.competitionsById.get(competitionId)
    if (!competition) continue
    if (
      !sponsorOwnsCompetition({
        sponsorId: input.sponsorId,
        override: input.overridesByCompetitionId.get(competitionId) ?? null,
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
    const { summary: competitionSummary, source: competitionSummarySource } =
      resolveCompetitionSummaryView(
        managementAuction?.competitionSnapshot,
        competition
      )
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
      acquiredVia,
      ...(managementAuction !== undefined
        ? { managementAuctionId: managementAuction._id }
        : {}),
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
