import { describe, expect, test } from "vitest"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { resolveSponsorBidStatus } from "./sponsorBidStatus"

const sponsorId = "sponsor1" as Id<"sponsors">

function auction(
  overrides: Partial<Doc<"sponsorshipAuctions">> = {}
): Doc<"sponsorshipAuctions"> {
  return {
    _id: "auction1" as Id<"sponsorshipAuctions">,
    _creationTime: 0,
    competitionId: "comp1" as Id<"competitions">,
    framework: "ebay_proxy",
    state: "active",
    currency: "EUR",
    startsAt: 0,
    endsAt: 1,
    antiSnipingWindowMs: 60_000,
    antiSnipingExtendMs: 60_000,
    startPriceCents: 1000,
    createdById: "user1" as Id<"users">,
    updatedById: "user1" as Id<"users">,
    updatedAt: 0,
    ...overrides,
  }
}

describe("resolveSponsorBidStatus", () => {
  test("proxy active: leader is winning", () => {
    expect(
      resolveSponsorBidStatus({
        auction: auction({
          currentLeaderSponsorId: sponsorId,
        }),
        sponsorId,
        hasSponsorValidBid: true,
      })
    ).toBe("winning")
  })

  test("proxy active: non-leader is not winning", () => {
    expect(
      resolveSponsorBidStatus({
        auction: auction({
          currentLeaderSponsorId: "other" as Id<"sponsors">,
        }),
        sponsorId,
        hasSponsorValidBid: true,
      })
    ).toBe("not_winning")
  })

  test("proxy closed: winner vs not winner", () => {
    expect(
      resolveSponsorBidStatus({
        auction: auction({
          state: "closed",
          winnerSponsorId: sponsorId,
        }),
        sponsorId,
        hasSponsorValidBid: true,
      })
    ).toBe("winner")

    expect(
      resolveSponsorBidStatus({
        auction: auction({
          state: "closed",
          winnerSponsorId: "other" as Id<"sponsors">,
        }),
        sponsorId,
        hasSponsorValidBid: true,
      })
    ).toBe("not_winner")
  })

  test("sealed active: bid submitted vs none", () => {
    const sealed = auction({ framework: "first_sealed" })
    expect(
      resolveSponsorBidStatus({
        auction: sealed,
        sponsorId,
        hasSponsorValidBid: true,
      })
    ).toBe("bid_submitted")
    expect(
      resolveSponsorBidStatus({
        auction: sealed,
        sponsorId,
        hasSponsorValidBid: false,
      })
    ).toBe("no_bid_submitted")
  })

  test("draft returns undefined", () => {
    expect(
      resolveSponsorBidStatus({
        auction: auction({ state: "draft" }),
        sponsorId,
        hasSponsorValidBid: false,
      })
    ).toBeUndefined()
  })
})
