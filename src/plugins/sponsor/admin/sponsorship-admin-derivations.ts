import type { Id } from "@/convex/_generated/dataModel"
import { normalizeSearchText } from "@/plugins/sponsor/lib/sponsorship-ui"

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
