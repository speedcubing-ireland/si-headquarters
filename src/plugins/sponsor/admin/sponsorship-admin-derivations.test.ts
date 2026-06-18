import { describe, expect, it } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { parseDatetimeLocalInput } from "@/plugins/sponsor/lib/sponsorship-ui"
import {
  attachSponsorNames,
  filterAuctionsBySearch,
  groupUnsponsoredCompetitionsByPhase,
  hasPendingAuctionEdits,
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

describe("hasPendingAuctionEdits", () => {
  const startsAtInput = "2026-01-01T10:00"
  const endsAtInput = "2026-01-01T12:00"
  const auctionDoc = {
    framework: "ebay_proxy" as const,
    startsAt: parseDatetimeLocalInput(startsAtInput) ?? 0,
    endsAt: parseDatetimeLocalInput(endsAtInput) ?? 0,
    startPriceCents: 10_000,
  }
  const inviteSponsorIds = ["s1" as Id<"sponsors">]

  const unchanged = {
    editFramework: "ebay_proxy" as const,
    editStartsAtInput: startsAtInput,
    editEndsAtInput: endsAtInput,
    editStartPriceEuros: "100",
    editInvitedSponsorIds: inviteSponsorIds,
    auction: auctionDoc,
    inviteSponsorIds,
  }

  it("is false when nothing changed", () => {
    expect(hasPendingAuctionEdits(unchanged)).toBe(false)
  })

  it("detects framework, price, and invite changes", () => {
    expect(
      hasPendingAuctionEdits({ ...unchanged, editFramework: "first_sealed" })
    ).toBe(true)
    expect(
      hasPendingAuctionEdits({ ...unchanged, editStartPriceEuros: "150" })
    ).toBe(true)
    expect(
      hasPendingAuctionEdits({ ...unchanged, editInvitedSponsorIds: [] })
    ).toBe(true)
  })
})
