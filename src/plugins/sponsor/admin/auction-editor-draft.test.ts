import { describe, expect, it } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import {
  createDraftFromManagerView,
  isAuctionDraftDirty,
  validateAuctionFormInputs,
  type EditableAuctionSnapshot,
} from "./auction-editor-draft"
import { formatCurrencyFromCents } from "@/plugins/sponsor/lib/sponsorship-ui"

const snapshot: EditableAuctionSnapshot = {
  auction: {
    framework: "ebay_proxy",
    startsAt: Date.UTC(2026, 0, 1, 10, 0),
    endsAt: Date.UTC(2026, 0, 1, 12, 0),
    startPriceCents: 10_000,
  },
  inviteSponsorIds: ["s1" as Id<"sponsors">, "s2" as Id<"sponsors">],
}

describe("createDraftFromManagerView", () => {
  it("round-trips to a non-dirty draft", () => {
    const draft = createDraftFromManagerView(snapshot)
    expect(draft.framework).toBe("ebay_proxy")
    expect(draft.startPriceEuros).toBe("100.00")
    expect(draft.invitedSponsorIds).toEqual(snapshot.inviteSponsorIds)
    expect(isAuctionDraftDirty(draft, snapshot)).toBe(false)
  })
})

describe("isAuctionDraftDirty", () => {
  const clean = createDraftFromManagerView(snapshot)

  it("detects each kind of change", () => {
    expect(
      isAuctionDraftDirty({ ...clean, framework: "first_sealed" }, snapshot)
    ).toBe(true)
    expect(
      isAuctionDraftDirty({ ...clean, startPriceEuros: "150" }, snapshot)
    ).toBe(true)
    expect(
      isAuctionDraftDirty(
        { ...clean, invitedSponsorIds: [snapshot.inviteSponsorIds[0]] },
        snapshot
      )
    ).toBe(true)
  })

  it("ignores invite ordering", () => {
    expect(
      isAuctionDraftDirty(
        {
          ...clean,
          invitedSponsorIds: [...snapshot.inviteSponsorIds].reverse(),
        },
        snapshot
      )
    ).toBe(false)
  })
})

describe("validateAuctionFormInputs", () => {
  const valid = createDraftFromManagerView(snapshot)

  it("accepts a valid draft and returns parsed values", () => {
    const result = validateAuctionFormInputs(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.values.startPriceCents).toBe(10_000)
      expect(result.values.startsAt).toBe(snapshot.auction.startsAt)
      expect(result.values.endsAt).toBe(snapshot.auction.endsAt)
    }
  })

  it("rejects empty invites", () => {
    expect(
      validateAuctionFormInputs({ ...valid, invitedSponsorIds: [] })
    ).toEqual({ ok: false, error: "Select at least one invited sponsor." })
  })

  it("rejects an end at or before the start", () => {
    expect(
      validateAuctionFormInputs({ ...valid, endsAtInput: valid.startsAtInput })
    ).toEqual({ ok: false, error: "Enter a valid start/end range." })
  })

  it("rejects a start price below the configured minimum", () => {
    expect(
      validateAuctionFormInputs({ ...valid, startPriceEuros: "0.50" })
    ).toEqual({
      ok: false,
      error: `Start price must be at least ${formatCurrencyFromCents(100)}.`,
    })
  })
})
