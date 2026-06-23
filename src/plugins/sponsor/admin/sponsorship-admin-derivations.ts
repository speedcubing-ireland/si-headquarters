import type { Id } from "@/convex/_generated/dataModel"
import { normalizeSearchText } from "@/plugins/sponsor/lib/sponsorship-ui"

export function filterAuctionsBySearch<
  T extends {
    subjectName: string
    competitionName?: string
    competitionPhaseName?: string
  },
>(auctions: T[], rawQuery: string): T[] {
  const search = normalizeSearchText(rawQuery)
  if (search.length === 0) return auctions
  return auctions.filter((auction) =>
    [
      auction.subjectName,
      auction.competitionName,
      auction.competitionPhaseName,
    ].some((field) => field?.toLowerCase().includes(search) ?? false)
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

function normalizeWcaCompetitionId(
  wcaCompetitionId: string | undefined | null
): string | null {
  const normalized = wcaCompetitionId?.trim()
  return normalized !== undefined && normalized.length > 0 ? normalized : null
}

export function filterPreviousClosedAuctionsForSubject<
  T extends {
    id: Id<"sponsorshipAuctions">
    state: string
    endsAt: number
    competitionId?: Id<"competitions">
    associatedCompetitionId?: Id<"competitions">
    wcaCompetitionId?: string
  },
>(
  auctions: readonly T[],
  input: {
    selectedAuctionId?: Id<"sponsorshipAuctions">
    competitionId?: Id<"competitions"> | null
    wcaCompetitionId?: string | null
    limit?: number
  }
): T[] {
  const selectedWcaCompetitionId = normalizeWcaCompetitionId(
    input.wcaCompetitionId
  )
  if (input.competitionId === null && selectedWcaCompetitionId === null) {
    return []
  }

  return auctions
    .filter((auction) => {
      if (auction.state !== "closed") return false
      if (auction.id === input.selectedAuctionId) return false
      if (
        input.competitionId !== null &&
        input.competitionId !== undefined &&
        (auction.competitionId === input.competitionId ||
          auction.associatedCompetitionId === input.competitionId)
      ) {
        return true
      }
      return (
        selectedWcaCompetitionId !== null &&
        normalizeWcaCompetitionId(auction.wcaCompetitionId) ===
          selectedWcaCompetitionId
      )
    })
    .sort((a, b) => b.endsAt - a.endsAt)
    .slice(0, input.limit ?? 5)
}
