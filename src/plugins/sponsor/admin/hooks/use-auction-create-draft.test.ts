import { describe, expect, it } from "vitest"
import { computeAuctionScheduleMs } from "./use-auction-create-draft"

const HOUR_MS = 60 * 60 * 1000
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)

describe("computeAuctionScheduleMs", () => {
  it("starts the auction after the configured delay", () => {
    const { startsAt } = computeAuctionScheduleMs(NOW, {
      startDelayHours: 1,
      durationHours: 1,
    })
    expect(startsAt).toBe(NOW + HOUR_MS)
  })

  it("ends the auction the configured duration after the start, not after now", () => {
    const { startsAt, endsAt } = computeAuctionScheduleMs(NOW, {
      startDelayHours: 2,
      durationHours: 3,
    })
    expect(startsAt).toBe(NOW + 2 * HOUR_MS)
    expect(endsAt).toBe(startsAt + 3 * HOUR_MS)
    expect(endsAt).toBe(NOW + 5 * HOUR_MS)
  })

  it("scales linearly with the delay", () => {
    const { startsAt: starts3h } = computeAuctionScheduleMs(NOW, {
      startDelayHours: 3,
      durationHours: 1,
    })
    expect(starts3h - NOW).toBe(3 * HOUR_MS)
  })

  it("scales linearly with the duration", () => {
    const { startsAt, endsAt } = computeAuctionScheduleMs(NOW, {
      startDelayHours: 1,
      durationHours: 4,
    })
    expect(endsAt - startsAt).toBe(4 * HOUR_MS)
  })

  it("duration gap is independent of start delay", () => {
    const a = computeAuctionScheduleMs(NOW, {
      startDelayHours: 1,
      durationHours: 2,
    })
    const b = computeAuctionScheduleMs(NOW, {
      startDelayHours: 5,
      durationHours: 2,
    })
    expect(a.endsAt - a.startsAt).toBe(b.endsAt - b.startsAt)
  })
})
