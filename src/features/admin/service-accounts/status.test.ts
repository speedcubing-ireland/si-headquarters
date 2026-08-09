import { describe, expect, test } from "vitest"
import { serviceAccountStatus } from "./status"

const NOW_MS = 2_000_000_000_000

describe("serviceAccountStatus", () => {
  test("distinguishes disconnected, expired, expiring, and healthy accounts", () => {
    expect(serviceAccountStatus(false, null, NOW_MS)).toBe("disconnected")
    expect(serviceAccountStatus(true, NOW_MS / 1000 - 1, NOW_MS)).toBe(
      "expired"
    )
    expect(serviceAccountStatus(true, NOW_MS / 1000 + 5 * 60, NOW_MS)).toBe(
      "expiring"
    )
    expect(serviceAccountStatus(true, NOW_MS / 1000 + 60 * 60, NOW_MS)).toBe(
      "healthy"
    )
  })
})
