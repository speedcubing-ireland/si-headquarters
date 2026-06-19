import { describe, expect, it } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import {
  attachSponsorNames,
  filterAuctionsBySearch,
  groupUnsponsoredCompetitionsByPhase,
} from "./sponsorship-admin-derivations"

const auction = (competitionName: string, competitionPhaseName: string) => ({
  competitionName,
  competitionPhaseName,
})

describe("filterAuctionsBySearch", () => {
  const auctions = [
    auction("Dublin Open", "Phase 1"),
    auction("Cork Cubing", "Qualifiers"),
  ]

  it("returns all auctions for a blank query", () => {
    expect(filterAuctionsBySearch(auctions, "   ")).toEqual(auctions)
  })

  it("matches on competition name or phase, case-insensitively", () => {
    expect(filterAuctionsBySearch(auctions, "dublin")).toEqual([auctions[0]])
    expect(filterAuctionsBySearch(auctions, "QUALIF")).toEqual([auctions[1]])
  })

  it("returns nothing when no auction matches", () => {
    expect(filterAuctionsBySearch(auctions, "galway")).toEqual([])
  })
})

describe("groupUnsponsoredCompetitionsByPhase", () => {
  it("drops sponsored competitions and sorts by phase then start", () => {
    const result = groupUnsponsoredCompetitionsByPhase([
      {
        sponsorPropertyStatus: "bidding",
        currentPhaseName: "Phase B",
        compStart: "2026-03-01",
      },
      {
        sponsorPropertyStatus: "sponsor",
        currentPhaseName: "Phase A",
        compStart: "2026-01-01",
      },
      {
        sponsorPropertyStatus: "none",
        currentPhaseName: "Phase A",
        compStart: "2026-02-01",
      },
      {
        sponsorPropertyStatus: "none",
        currentPhaseName: "Phase A",
        compStart: "2026-01-15",
      },
    ])

    expect(result.map((group) => group.phase)).toEqual(["Phase A", "Phase B"])
    expect(result[0]?.items.map((item) => item.compStart)).toEqual([
      "2026-01-15",
      "2026-02-01",
    ])
  })
})

describe("attachSponsorNames", () => {
  it("resolves a name for each outcome", () => {
    const result = attachSponsorNames(
      [{ sponsorId: "s1" as Id<"sponsors"> }],
      (id) => (id === ("s1" as Id<"sponsors">) ? "Acme" : "Unknown sponsor")
    )
    expect(result).toEqual([{ sponsorId: "s1", sponsorName: "Acme" }])
  })
})
