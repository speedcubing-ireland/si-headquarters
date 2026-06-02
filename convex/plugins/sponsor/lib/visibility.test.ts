import { describe, expect, test } from "vitest"
import {
  isBidHistoryVisibleToSponsor,
  isSponsorVisibleAuctionState,
} from "./visibility"

describe("sponsorship visibility rules", () => {
  test("sponsors cannot view draft auctions", () => {
    expect(isSponsorVisibleAuctionState("draft")).toBe(false)
    expect(isSponsorVisibleAuctionState("scheduled")).toBe(true)
    expect(isSponsorVisibleAuctionState("active")).toBe(true)
    expect(isSponsorVisibleAuctionState("closed")).toBe(true)
  })

  test("bid history is only visible while active or after close", () => {
    expect(
      isBidHistoryVisibleToSponsor({
        state: "scheduled",
        framework: "ebay_proxy",
      })
    ).toBe(false)
    expect(
      isBidHistoryVisibleToSponsor({
        state: "active",
        framework: "ebay_proxy",
      })
    ).toBe(true)
    expect(
      isBidHistoryVisibleToSponsor({
        state: "closed",
        framework: "ebay_proxy",
      })
    ).toBe(true)
  })

  test("sealed auctions never expose bid history", () => {
    expect(
      isBidHistoryVisibleToSponsor({
        state: "active",
        framework: "first_sealed",
      })
    ).toBe(false)
    expect(
      isBidHistoryVisibleToSponsor({
        state: "closed",
        framework: "first_sealed",
      })
    ).toBe(false)
    expect(
      isBidHistoryVisibleToSponsor({
        state: "active",
        framework: "vickrey",
      })
    ).toBe(false)
  })
})
