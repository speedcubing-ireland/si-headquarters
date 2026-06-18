import type { Id } from "@/convex/_generated/dataModel"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  hasSameIdSet,
  normalizeSearchText,
  parseDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function filterAuctionsBySearch<
  T extends { competitionName: string; competitionPhaseName: string },
>(auctions: T[], rawQuery: string): T[] {
  const search = normalizeSearchText(rawQuery)
  if (search.length === 0) return auctions
  return auctions.filter(
    (auction) =>
      auction.competitionName.toLowerCase().includes(search) ||
      auction.competitionPhaseName.toLowerCase().includes(search)
  )
}

export function groupUnsponsoredCompetitionsByPhase<
  T extends {
    sponsorPropertyStatus: string
    currentPhaseName: string
    compStart: string
  },
>(competitions: T[]): { phase: string; items: T[] }[] {
  const byPhase = new Map<string, T[]>()
  for (const competition of competitions) {
    if (competition.sponsorPropertyStatus === "sponsor") continue
    const current = byPhase.get(competition.currentPhaseName) ?? []
    current.push(competition)
    byPhase.set(competition.currentPhaseName, current)
  }
  return [...byPhase.entries()]
    .map(([phase, items]) => ({
      phase,
      items: [...items].sort((a, b) => a.compStart.localeCompare(b.compStart)),
    }))
    .sort((a, b) => a.phase.localeCompare(b.phase))
}

export function attachSponsorNames<T extends { sponsorId: Id<"sponsors"> }>(
  outcomes: readonly T[],
  resolveSponsorName: (sponsorId: Id<"sponsors">) => string
): (T & { sponsorName: string })[] {
  return outcomes.map((outcome) => ({
    ...outcome,
    sponsorName: resolveSponsorName(outcome.sponsorId),
  }))
}

export function hasPendingAuctionEdits(input: {
  editFramework: SponsorshipAuctionFramework
  editStartsAtInput: string
  editEndsAtInput: string
  editStartPriceEuros: string
  editInvitedSponsorIds: Id<"sponsors">[]
  auction: {
    framework: SponsorshipAuctionFramework
    startsAt: number
    endsAt: number
    startPriceCents: number
  }
  inviteSponsorIds: Id<"sponsors">[]
}): boolean {
  const startPrice = Number(input.editStartPriceEuros)
  const startPriceCents = Number.isFinite(startPrice)
    ? Math.round(startPrice * 100)
    : null
  return (
    input.editFramework !== input.auction.framework ||
    parseDatetimeLocalInput(input.editStartsAtInput) !==
      input.auction.startsAt ||
    parseDatetimeLocalInput(input.editEndsAtInput) !== input.auction.endsAt ||
    startPriceCents !== input.auction.startPriceCents ||
    !hasSameIdSet(input.editInvitedSponsorIds, input.inviteSponsorIds)
  )
}
