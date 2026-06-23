import { describe, expect, it } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import {
  attachSponsorNames,
  filterAuctionsBySearch,
  filterPreviousClosedAuctionsForSubject,
  groupUnsponsoredCompetitionsByPhase,
} from "./sponsorship-admin-derivations"

const auction = (competitionName: string, competitionPhaseName: string) => ({
  subjectName: competitionName,
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

describe("filterPreviousClosedAuctionsForSubject", () => {
  const auctions = [
    {
      id: "direct" as Id<"sponsorshipAuctions">,
      state: "closed",
      endsAt: 30,
      wcaCompetitionId: "IrishChampionship2026",
    },
    {
      id: "linked" as Id<"sponsorshipAuctions">,
      state: "closed",
      endsAt: 20,
      competitionId: "comp1" as Id<"competitions">,
      wcaCompetitionId: "IrishChampionship2026",
    },
    {
      id: "other" as Id<"sponsorshipAuctions">,
      state: "closed",
      endsAt: 10,
      competitionId: "comp2" as Id<"competitions">,
      wcaCompetitionId: "CorkOpen2026",
    },
    {
      id: "custom-associated" as Id<"sponsorshipAuctions">,
      state: "closed",
      endsAt: 15,
      associatedCompetitionId: "comp1" as Id<"competitions">,
    },
    {
      id: "open" as Id<"sponsorshipAuctions">,
      state: "active",
      endsAt: 40,
      wcaCompetitionId: "IrishChampionship2026",
    },
  ]

  it("matches direct and HQ-linked auctions through the same WCA id", () => {
    expect(
      filterPreviousClosedAuctionsForSubject(auctions, {
        wcaCompetitionId: " IrishChampionship2026 ",
      }).map((auction) => auction.id)
    ).toEqual(["direct", "linked"])
  })

  it("matches by competition id and by the linked competition WCA id", () => {
    expect(
      filterPreviousClosedAuctionsForSubject(auctions, {
        competitionId: "comp1" as Id<"competitions">,
        wcaCompetitionId: "IrishChampionship2026",
      }).map((auction) => auction.id)
    ).toEqual(["direct", "linked", "custom-associated"])
  })

  it("excludes the selected auction when editing", () => {
    expect(
      filterPreviousClosedAuctionsForSubject(auctions, {
        selectedAuctionId: "linked" as Id<"sponsorshipAuctions">,
        competitionId: "comp1" as Id<"competitions">,
        wcaCompetitionId: "IrishChampionship2026",
      }).map((auction) => auction.id)
    ).toEqual(["direct", "custom-associated"])
  })
})
