import { describe, expect, test } from "vitest"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import {
  buildSponsorSponsorshipListItems,
  sponsorOwnsCompetition,
} from "./sponsorOwnedCompetitions"

const sponsorId = "sponsor1" as Id<"sponsors">

function makeAuction(
  overrides: Partial<Doc<"sponsorshipAuctions">> = {}
): Doc<"sponsorshipAuctions"> {
  const now = Date.now()
  return {
    _id: "auction1" as Id<"sponsorshipAuctions">,
    _creationTime: now,
    competitionId: "comp1" as Id<"competitions">,
    framework: "ebay_proxy",
    state: "closed",
    currency: "EUR",
    startsAt: now - 86_400_000,
    endsAt: now - 3_600_000,
    antiSnipingWindowMs: 300_000,
    antiSnipingExtendMs: 300_000,
    startPriceCents: 10_000,
    currentPriceCents: 12_000,
    winnerSponsorId: sponsorId,
    createdById: "user1" as Id<"users">,
    updatedById: "user1" as Id<"users">,
    updatedAt: now,
    ...overrides,
  }
}

function makeCompetition(
  overrides: Partial<Doc<"competitions">> = {}
): Doc<"competitions"> {
  return {
    _id: "comp1" as Id<"competitions">,
    _creationTime: 0,
    name: "June Comp 123",
    compDates: { from: "2026-09-05", to: "2026-09-06" },
    ...overrides,
  } as Doc<"competitions">
}

describe("sponsorOwnsCompetition", () => {
  test("includes closed auction winners", () => {
    expect(
      sponsorOwnsCompetition({
        sponsorId,
        competition: makeCompetition(),
        auctions: [makeAuction()],
      })
    ).toBe(true)
  })

  test("includes manual sponsor assignments", () => {
    expect(
      sponsorOwnsCompetition({
        sponsorId,
        competition: makeCompetition({ manualSponsorId: sponsorId }),
        auctions: [makeAuction({ state: "active", winnerSponsorId: undefined })],
      })
    ).toBe(true)
  })

  test("excludes lost closed auctions", () => {
    expect(
      sponsorOwnsCompetition({
        sponsorId,
        competition: makeCompetition(),
        auctions: [
          makeAuction({
            winnerSponsorId: "other" as Id<"sponsors">,
          }),
        ],
      })
    ).toBe(false)
  })
})

describe("buildSponsorSponsorshipListItems", () => {
  test("returns owned competitions sorted with ongoing first", () => {
    const ongoing = makeAuction({
      _id: "auction-ongoing" as Id<"sponsorshipAuctions">,
      competitionId: "comp-ongoing" as Id<"competitions">,
      winnerSponsorId: sponsorId,
    })
    const upcoming = makeAuction({
      _id: "auction-upcoming" as Id<"sponsorshipAuctions">,
      competitionId: "comp-upcoming" as Id<"competitions">,
      winnerSponsorId: sponsorId,
    })

    const items = buildSponsorSponsorshipListItems({
      sponsorId,
      auctions: [upcoming, ongoing],
      competitionsById: new Map([
        [
          "comp-ongoing" as Id<"competitions">,
          makeCompetition({
            _id: "comp-ongoing" as Id<"competitions">,
            name: "Ongoing Comp",
            compDates: { from: "2020-01-01", to: "2030-01-01" },
          }),
        ],
        [
          "comp-upcoming" as Id<"competitions">,
          makeCompetition({
            _id: "comp-upcoming" as Id<"competitions">,
            name: "Upcoming Comp",
            compDates: { from: "2099-01-01", to: "2099-01-02" },
          }),
        ],
      ]),
      now: new Date(2026, 0, 15).getTime(),
    })

    expect(items.map((item) => item.competitionName)).toEqual([
      "Ongoing Comp",
      "Upcoming Comp",
    ])
    expect(items[0]?.lifecycle).toBe("ongoing")
    expect(items[1]?.lifecycle).toBe("upcoming")
  })
})
