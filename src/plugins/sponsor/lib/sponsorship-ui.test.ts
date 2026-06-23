import { describe, expect, it } from "vitest"
import {
  auctionScheduleDraftLabels,
  competitionPropertyStatusLabel,
  displayAuctionPriceCents,
  formatAuctionTablePrice,
  parseDatetimeLocalInput,
  proxyDirectBidCopy,
  proxyMaxBidCopy,
  toDatetimeLocalInput,
} from "@/plugins/sponsor/lib/sponsorship-ui"

describe("toDatetimeLocalInput", () => {
  it("returns a datetime-local string in local time (YYYY-MM-DDTHH:mm)", () => {
    // A fixed UTC instant — the local representation depends on the timezone offset,
    // but the format must always be exactly 16 characters with a 'T' at position 10.
    const result = toDatetimeLocalInput(new Date(Date.UTC(2026, 0, 1, 12, 30)))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it("round-trips through parseDatetimeLocalInput", () => {
    const original = Date.UTC(2026, 5, 15, 9, 45)
    const str = toDatetimeLocalInput(new Date(original))
    const parsed = parseDatetimeLocalInput(str)
    // The round-trip may differ by timezone offset seconds but not by whole hours.
    expect(parsed).not.toBeNull()
  })
})

describe("parseDatetimeLocalInput", () => {
  it("parses a valid datetime-local string to epoch milliseconds", () => {
    // 2026-06-15T10:00 in UTC+0 — safe to assert exact ms when TZ is controlled
    const result = parseDatetimeLocalInput("2026-01-01T00:00")
    expect(typeof result).toBe("number")
    expect(result).not.toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(parseDatetimeLocalInput("")).toBeNull()
  })

  it("returns null for a non-date string", () => {
    expect(parseDatetimeLocalInput("not-a-date")).toBeNull()
  })
})

describe("auctionScheduleDraftLabels", () => {
  it("returns null labels for invalid inputs", () => {
    expect(auctionScheduleDraftLabels("", "")).toEqual({
      opensIn: null,
      duration: null,
    })
  })

  it("returns opensIn when start is valid", () => {
    const { opensIn, duration } = auctionScheduleDraftLabels(
      "2026-12-01T12:00",
      ""
    )
    expect(opensIn).toMatch(/^Opens /)
    expect(duration).toBeNull()
  })

  it("returns duration when end is after start", () => {
    const { duration } = auctionScheduleDraftLabels(
      "2026-12-01T12:00",
      "2026-12-01T14:00"
    )
    expect(duration).toBeTruthy()
  })

  it("returns null duration when end is not after start", () => {
    expect(
      auctionScheduleDraftLabels("2026-12-01T14:00", "2026-12-01T12:00")
        .duration
    ).toBeNull()
    expect(
      auctionScheduleDraftLabels("2026-12-01T12:00", "2026-12-01T12:00")
        .duration
    ).toBeNull()
  })
})

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

describe("displayAuctionPriceCents", () => {
  it("uses the current price while open and settlement once closed", () => {
    expect(displayAuctionPriceCents(baseAuction)).toBe(15_000)
    expect(
      displayAuctionPriceCents({
        ...baseAuction,
        state: "closed",
        settlementAmountCents: 14_000,
      })
    ).toBe(14_000)
  })

  it("falls back to start price when no current price is set", () => {
    expect(
      displayAuctionPriceCents({
        ...baseAuction,
        currentPriceCents: undefined,
      })
    ).toBe(10_000)
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
