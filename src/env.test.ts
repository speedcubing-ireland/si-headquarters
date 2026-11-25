import { describe, expect, test } from "vitest"
import { createClientEnv, type ClientRuntimeEnv } from "@/env.schema"

function validEnv(overrides: Partial<ClientRuntimeEnv> = {}): ClientRuntimeEnv {
  return {
    VITE_CONVEX_URL: "https://example.convex.cloud",
    VITE_CONVEX_SITE_URL: "https://example.convex.site",
    VITE_SPONSOR_SITE: undefined,
    VITE_GIT_SHA: undefined,
    ...overrides,
  }
}

describe("client env", () => {
  test("parses optional flags as false by default", () => {
    const env = createClientEnv(validEnv())

    expect(env.VITE_SPONSOR_SITE).toBe(false)
  })

  test("parses truthy flag strings", () => {
    const env = createClientEnv(
      validEnv({
        VITE_SPONSOR_SITE: "TRUE",
      })
    )

    expect(env.VITE_SPONSOR_SITE).toBe(true)
  })

  test("leaves the git sha unset when missing or empty", () => {
    expect(createClientEnv(validEnv()).VITE_GIT_SHA).toBeUndefined()
    expect(
      createClientEnv(validEnv({ VITE_GIT_SHA: "" })).VITE_GIT_SHA
    ).toBeUndefined()
  })

  test("passes the git sha through", () => {
    const sha = "837cc4c0123456789abcdef0123456789abcdef0"

    expect(createClientEnv(validEnv({ VITE_GIT_SHA: sha })).VITE_GIT_SHA).toBe(
      sha
    )
  })

  test("rejects invalid urls", () => {
    expect(() =>
      createClientEnv(validEnv({ VITE_CONVEX_URL: "not-a-url" }))
    ).toThrow("Invalid environment variables")
  })
})
