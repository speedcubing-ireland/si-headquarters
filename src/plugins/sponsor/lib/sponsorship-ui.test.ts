import { describe, expect, it } from "vitest"
import {
  formatAuctionPriceLine,
  formatAuctionTablePrice,
} from "@/plugins/sponsor/lib/sponsorship-ui"

const baseAuction = {
  framework: "ebay_proxy" as const,
  state: "active" as const,
  startPriceCents: 10_000,
  currentPriceCents: 15_000,
}

describe("formatAuctionPriceLine", () => {
  it("shows sealed minimum before close", () => {
    expect(
      formatAuctionPriceLine({
        ...baseAuction,
        framework: "first_sealed",
        state: "active",
        currentPriceCents: undefined,
      }),
    ).toBe("Minimum bid: EUR 100.00 · Price sealed until close")
  })

  it("shows sealed winning bid after close", () => {
    expect(
      formatAuctionPriceLine({
        ...baseAuction,
        framework: "vickrey",
        state: "closed",
        settlementAmountCents: 12_500,
      }),
    ).toBe("Winning bid: EUR 125.00")
  })

  it("shows proxy current price while active", () => {
    expect(formatAuctionPriceLine(baseAuction)).toBe("Current: EUR 150.00")
  })

  it("appends winning bid for closed proxy auctions", () => {
    expect(
      formatAuctionPriceLine({
        ...baseAuction,
        state: "closed",
        settlementAmountCents: 14_000,
      }),
    ).toBe("Current: EUR 150.00 · Winning bid: EUR 140.00")
  })
})

describe("formatAuctionTablePrice", () => {
  it("uses settlement for closed auctions", () => {
    expect(
      formatAuctionTablePrice({
        ...baseAuction,
        state: "closed",
        settlementAmountCents: 14_000,
      }),
    ).toEqual({ amountCents: 14_000, showWinningBidLabel: true })
  })

  it("uses current price for open proxy auctions", () => {
    expect(formatAuctionTablePrice(baseAuction)).toEqual({
      amountCents: 15_000,
      showWinningBidLabel: false,
    })
  })
})
