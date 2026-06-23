// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { buildWcaAuthorizeUrl } from "@/convex/wcaLogin/wcaLogin"

describe("WCA organiser OAuth", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_WCA_ID", "organiser-client")
    vi.stubEnv("AUTH_WCA_SECRET", "organiser-secret")
    vi.stubEnv("DEPLOYMENT_CONTEXT", "staging")
    vi.stubEnv("SITE_URL", "https://hq.example.test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("does not send unsupported PKCE parameters to WCA", () => {
    const authorizeUrl = buildWcaAuthorizeUrl("invite-token", "organiser")

    expect(authorizeUrl).not.toBeNull()
    const url = new URL(authorizeUrl ?? "")
    expect(url.origin).toBe("https://staging.worldcubeassociation.org")
    expect(url.searchParams.get("state")).toBe("invite-token")
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://hq.example.test/invite/organiser"
    )
    expect(url.searchParams.has("code_challenge")).toBe(false)
    expect(url.searchParams.has("code_challenge_method")).toBe(false)
  })

  test("staff flow redirects to the dedicated staff route with no state", () => {
    const authorizeUrl = buildWcaAuthorizeUrl("", "staff")

    expect(authorizeUrl).not.toBeNull()
    const url = new URL(authorizeUrl ?? "")
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://hq.example.test/auth/wca"
    )
    expect(url.searchParams.has("state")).toBe(false)
  })
})
