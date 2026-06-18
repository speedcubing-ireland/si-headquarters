import { describe, expect, it } from "vitest"
import {
  competitionPropertyStatusLabel,
  formatAuctionTablePrice,
  proxyDirectBidCopy,
  proxyMaxBidCopy,
} from "@/plugins/sponsor/lib/sponsorship-ui"

const baseAuction = {
  framework: "ebay_proxy" as const,
  state: "active" as const,
  startPriceCents: 10_000,
  currentPriceCents: 15_000,
}

describe("competitionPropertyStatusLabel", () => {
  it("uses sponsor name when provided", () => {
    expect(competitionPropertyStatusLabel("sponsor", "Acme Cubes")).toBe(
      "Acme Cubes"
    )
  })

  it("maps resolved statuses for competition properties", () => {
    expect(competitionPropertyStatusLabel("not_offered")).toBe("Not Offered")
    expect(competitionPropertyStatusLabel("none")).toBe("No Sponsor")
    expect(competitionPropertyStatusLabel("bidding")).toBe(
      "Bidding in progress"
    )
  })
})

describe("formatAuctionTablePrice", () => {
  it("uses settlement for closed auctions", () => {
    expect(
      formatAuctionTablePrice({
        ...baseAuction,
        state: "closed",
        settlementAmountCents: 14_000,
      })
    ).toEqual({ amountCents: 14_000, showWinningBidLabel: true })
  })

  it("uses current price for open proxy auctions", () => {
    expect(formatAuctionTablePrice(baseAuction)).toEqual({
      amountCents: 15_000,
      showWinningBidLabel: false,
    })
  })
})

describe("proxyDirectBidCopy", () => {
  it("tells a winning sponsor they can raise the visible price", () => {
    expect(proxyDirectBidCopy("winning")).toMatchObject({
      title: "Raise current price",
      submitLabel: "Raise current price",
      confirmationTitle: "Raise the visible price?",
    })
  })

  it("frames an outbid sponsor's visible bid as a counter bid", () => {
    expect(proxyDirectBidCopy("not_winning")).toMatchObject({
      title: "Counter bid",
      submitLabel: "Place counter bid",
    })
  })

  it("uses first-bid language when the sponsor has not bid yet", () => {
    expect(proxyDirectBidCopy("no_bid_submitted")).toMatchObject({
      title: "Place bid",
      submitLabel: "Place bid",
    })
  })
})

describe("proxyMaxBidCopy", () => {
  it("uses set language before a max bid exists", () => {
    expect(proxyMaxBidCopy(undefined)).toMatchObject({
      title: "Set max bid",
      submitLabel: "Set max bid",
    })
  })

  it("uses increase language after a max bid exists", () => {
    expect(proxyMaxBidCopy(12_500)).toMatchObject({
      title: "Increase max bid",
      submitLabel: "Increase max bid",
    })
  })
})
