import { afterEach, describe, expect, test, vi } from "vitest"
import { DEPLOYMENT_CONTEXT_ENV } from "@/convex/deploymentContext"
import { createWcaClient } from "@/convex/plugins/wca/client"
import { oauthCredentialEnv, plugin } from "@/convex/plugins/wca/oauth"

describe("WCA deployment-aware URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("createWcaClient uses production API URL", () => {
    vi.stubEnv(DEPLOYMENT_CONTEXT_ENV, "production")

    const client = createWcaClient("access-token")

    expect(client.getConfig().baseUrl).toBe(
      "https://www.worldcubeassociation.org/api"
    )
  })

  test("createWcaClient uses staging API URL", () => {
    vi.stubEnv(DEPLOYMENT_CONTEXT_ENV, "staging")

    const client = createWcaClient("access-token")

    expect(client.getConfig().baseUrl).toBe(
      "https://staging.worldcubeassociation.org/api"
    )
  })

  test("OAuth authorization URL uses production WCA URL", () => {
    vi.stubEnv(DEPLOYMENT_CONTEXT_ENV, "production")
    vi.stubEnv(oauthCredentialEnv.clientId, "client-id")

    const url = new URL(
      plugin.buildAuthorizeUrl({
        redirectUri: plugin.redirectUri(),
        state: "state",
      })
    )

    expect(url.origin).toBe("https://www.worldcubeassociation.org")
    expect(url.pathname).toBe("/oauth/authorize")
    expect(url.searchParams.get("client_id")).toBe("client-id")
  })

  test("OAuth authorization URL uses staging WCA URL", () => {
    vi.stubEnv(DEPLOYMENT_CONTEXT_ENV, "staging")
    vi.stubEnv(oauthCredentialEnv.clientId, "client-id")

    const url = new URL(
      plugin.buildAuthorizeUrl({
        redirectUri: plugin.redirectUri(),
        state: "state",
      })
    )

    expect(url.origin).toBe("https://staging.worldcubeassociation.org")
    expect(url.pathname).toBe("/oauth/authorize")
    expect(url.searchParams.get("client_id")).toBe("client-id")
  })
})
