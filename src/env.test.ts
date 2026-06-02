import { describe, expect, test } from "vitest"
import { createClientEnv, type ClientRuntimeEnv } from "@/env.schema"

function validEnv(overrides: Partial<ClientRuntimeEnv> = {}): ClientRuntimeEnv {
  return {
    VITE_CONVEX_URL: "https://example.convex.cloud",
    VITE_CONVEX_SITE_URL: "https://example.convex.site",
    VITE_SPONSORSHIP_ENABLED: undefined,
    VITE_SPONSOR_SITE: undefined,
    ...overrides,
  }
}

describe("client env", () => {
  test("parses optional flags as false by default", () => {
    const env = createClientEnv(validEnv())

    expect(env.VITE_SPONSORSHIP_ENABLED).toBe(false)
    expect(env.VITE_SPONSOR_SITE).toBe(false)
  })

  test("parses truthy flag strings", () => {
    const env = createClientEnv(
      validEnv({
        VITE_SPONSORSHIP_ENABLED: "yes",
        VITE_SPONSOR_SITE: "TRUE",
      })
    )

    expect(env.VITE_SPONSORSHIP_ENABLED).toBe(true)
    expect(env.VITE_SPONSOR_SITE).toBe(true)
  })

  test("rejects invalid urls", () => {
    expect(() =>
      createClientEnv(validEnv({ VITE_CONVEX_URL: "not-a-url" }))
    ).toThrow("Invalid environment variables")
  })
})
