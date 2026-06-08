import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

async function importFlags() {
  vi.resetModules()
  return import("./feature-flags")
}

function stubWindowLocation(hostname: string, port = "") {
  vi.stubGlobal("window", {
    location: { hostname, port },
  })
}

describe("isSponsorshipEnabled", () => {
  beforeEach(() => {
    vi.resetModules()
    stubWindowLocation("hq.speedcubing.ie")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test.each(["1", "true", "yes", "TRUE", "True"])(
    "returns true for %s",
    async (value) => {
      vi.stubEnv("VITE_SPONSORSHIP_ENABLED", value)
      const { isSponsorshipEnabled } = await importFlags()
      expect(isSponsorshipEnabled).toBe(true)
    }
  )

  test.each(["", "0", "false"])("returns false for %s", async (value) => {
    vi.stubEnv("VITE_SPONSORSHIP_ENABLED", value)
    const { isSponsorshipEnabled } = await importFlags()
    expect(isSponsorshipEnabled).toBe(false)
  })

  test("returns true on the sponsor portal production host", async () => {
    vi.stubEnv("VITE_SPONSORSHIP_ENABLED", "")
    stubWindowLocation("sponsors.speedcubingireland.com")
    const { isSponsorshipEnabled } = await importFlags()
    expect(isSponsorshipEnabled).toBe(true)
  })
})
