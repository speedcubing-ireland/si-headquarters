import { describe, expect, it } from "vitest"
import {
  formatAuctionCountdown,
  parseBidAmountCents,
  resolveDisplayedMaxBidEuros,
} from "./auction-bid-form"

describe("parseBidAmountCents", () => {
  it("flags an empty input distinctly", () => {
    expect(parseBidAmountCents("", 1000)).toEqual({ status: "empty" })
  })

  it("rejects non-numeric and non-positive amounts", () => {
    expect(parseBidAmountCents("abc", 1000)).toEqual({ status: "invalid" })
    expect(parseBidAmountCents("0", 1000)).toEqual({ status: "invalid" })
    expect(parseBidAmountCents("-5", 1000)).toEqual({ status: "invalid" })
  })

  it("rejects amounts below the minimum, reporting the minimum", () => {
    expect(parseBidAmountCents("9.99", 1000)).toEqual({
      status: "below_minimum",
      minimumCents: 1000,
    })
  })

  it("accepts a valid amount and rounds euros to cents", () => {
    expect(parseBidAmountCents("10", 1000)).toEqual({
      status: "ok",
      cents: 1000,
    })
    expect(parseBidAmountCents("12.999", 1000)).toEqual({
      status: "ok",
      cents: 1300,
    })
  })
})

describe("resolveDisplayedMaxBidEuros", () => {
  const base = {
    override: null,
    overrideAuctionId: null,
    currentAuctionId: "auction1",
    serverMaxBidCents: 5000 as number | undefined,
    isProxyAuction: true,
  }

  it("shows the server max bid when there is no local override", () => {
    expect(resolveDisplayedMaxBidEuros(base)).toBe("50.00")
  })

  it("prefers a local override for the current auction", () => {
    expect(
      resolveDisplayedMaxBidEuros({
        ...base,
        override: "75.00",
        overrideAuctionId: "auction1",
      })
    ).toBe("75.00")
  })

  it("ignores an override left over from a different auction", () => {
    expect(
      resolveDisplayedMaxBidEuros({
        ...base,
        override: "75.00",
        overrideAuctionId: "auctionOther",
      })
    ).toBe("50.00")
  })

  it("is empty for sealed auctions or when no server max exists", () => {
    expect(
      resolveDisplayedMaxBidEuros({ ...base, isProxyAuction: false })
    ).toBe("")
    expect(
      resolveDisplayedMaxBidEuros({ ...base, serverMaxBidCents: undefined })
    ).toBe("")
  })
})

describe("formatAuctionCountdown", () => {
  it("formats the remaining time as HH:MM:SS", () => {
    expect(formatAuctionCountdown(3_661_000, 0)).toBe("01:01:01")
  })

  it("clamps to zero once the target has passed", () => {
    expect(formatAuctionCountdown(0, 5_000)).toBe("00:00:00")
  })
})
