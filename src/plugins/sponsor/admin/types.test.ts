import { describe, expect, it } from "vitest"
import { isAdminSponsorshipTab } from "./types"

describe("isAdminSponsorshipTab", () => {
  it.each(["open", "closed", "sponsors", "auctionTypes", "auctionSettings"])(
    "accepts %s",
    (value) => {
      expect(isAdminSponsorshipTab(value)).toBe(true)
    }
  )

  it.each(["", "Open", "OPEN", "auction-types", "settings", "unknown"])(
    "rejects %s",
    (value) => {
      expect(isAdminSponsorshipTab(value)).toBe(false)
    }
  )
})
