/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH } from "@/convex/integrations/serviceAccountPaths"
import { seedDirectorUser, seedVolunteerTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function stubCanvaOAuthEnv() {
  vi.stubEnv("SERVICE_CANVA_ID", "canva-client-id")
  vi.stubEnv("SERVICE_CANVA_SECRET", "canva-client-secret")
}

function stubWcaOAuthEnv() {
  vi.stubEnv("SERVICE_WCA_ID", "wca-client-id")
  vi.stubEnv("SERVICE_WCA_SECRET", "wca-client-secret")
  vi.stubEnv("DEPLOYMENT_CONTEXT", "staging")
}

const SITE_URL = "http://localhost:5173"
const EXPECTED_REDIRECT_URI = `${SITE_URL}${SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH}`
// Canva refuses `localhost`, so its redirect URI uses the loopback IP while the
// site itself is still served from `SITE_URL`.
const EXPECTED_CANVA_REDIRECT_URI = `http://127.0.0.1:5173${SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH}`

function stubSiteUrl() {
  vi.stubEnv("SITE_URL", SITE_URL)
}

function stateFromAuthorizeUrl(authorizeUrl: string): string {
  const state = new URL(authorizeUrl).searchParams.get("state")
  if (state === null) {
    throw new Error("authorize URL is missing a state parameter")
  }
  return state
}

async function startCanvaConnect(t: TestConvex<typeof schema>) {
  stubCanvaOAuthEnv()
  stubSiteUrl()
  const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))
  const director = t.withIdentity({ subject: directorId })
  const { authorizeUrl } = await director.mutation(
    api.integrations.serviceAccountConnect.startConnect,
    { service: "canva" }
  )
  return { directorId, director, authorizeUrl }
}

describe("service account administration", () => {
  test("directors can inspect operational metadata without token values", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceTokens", {
        service: "google",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        expiresAt: 2_000_000_000,
      })
      return id
    })

    const accounts = await t
      .withIdentity({ subject: directorId })
      .query(api.integrations.tokensStore.listServiceAccounts, {})
    const google = accounts.find((account) => account.service === "google")

    expect(google).toMatchObject({
      displayName: "Google",
      connected: true,
      expiresAt: 2_000_000_000,
      hasRefreshToken: true,
    })
    expect(JSON.stringify(accounts)).not.toContain("secret-access-token")
    expect(JSON.stringify(accounts)).not.toContain("secret-refresh-token")
  })

  test("non-directors cannot inspect or refresh service accounts", async () => {
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.query(api.integrations.tokensStore.listServiceAccounts, {})
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
    await expect(
      volunteer.action(api.integrations.tokens.refreshServiceAccount, {
        service: "google",
      })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
  })

  test("refresh reports when an account is not connected", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))

    const result = await t
      .withIdentity({ subject: directorId })
      .action(api.integrations.tokens.refreshServiceAccount, {
        service: "google",
      })

    expect(result).toEqual({
      success: false,
      message: "Google is not connected.",
    })
  })

  test("a stale refresh result cannot overwrite a newer token", async () => {
    const t = convexTest(schema, modules)
    const original = {
      accessToken: "original-access-token",
      refreshToken: "original-refresh-token",
      expiresAt: 1,
    }
    const current = {
      accessToken: "current-access-token",
      refreshToken: "current-refresh-token",
      expiresAt: 2_000_000_000,
    }
    await t.mutation(internal.integrations.tokensStore.saveToken, {
      service: "canva",
      token: original,
    })

    await expect(
      t.mutation(internal.integrations.tokensStore.saveRefreshedToken, {
        service: "canva",
        expectedToken: original,
        token: current,
      })
    ).resolves.toEqual({ status: "saved" })

    const staleResult = await t.mutation(
      internal.integrations.tokensStore.saveRefreshedToken,
      {
        service: "canva",
        expectedToken: original,
        token: {
          accessToken: "stale-access-token",
          refreshToken: "stale-refresh-token",
          expiresAt: 2_000_000_001,
        },
      }
    )

    expect(staleResult).toEqual({ status: "superseded", token: current })
    await expect(
      t.query(internal.integrations.tokensStore.loadToken, {
        service: "canva",
      })
    ).resolves.toEqual(current)
  })

  test("a refresh recovers when another request already rotated Canva's token", async () => {
    stubCanvaOAuthEnv()
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceTokens", {
        service: "canva",
        accessToken: "expired-access-token",
        refreshToken: "single-use-refresh-token",
        expiresAt: 1,
      })
      return id
    })
    const replacement = {
      accessToken: "concurrent-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 14_400,
    }
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      await t.mutation(internal.integrations.tokensStore.saveToken, {
        service: "canva",
        token: replacement,
      })
      return Response.json(
        { code: "invalid_grant", message: "Invalid refresh token" },
        { status: 400 }
      )
    })

    const result = await t
      .withIdentity({ subject: directorId })
      .action(api.integrations.tokens.refreshServiceAccount, {
        service: "canva",
      })

    expect(result).toEqual({
      success: true,
      expiresAt: replacement.expiresAt,
    })
  })

  test("refresh errors retain Canva's safe provider error details", async () => {
    stubCanvaOAuthEnv()
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceTokens", {
        service: "canva",
        accessToken: "expired-access-token",
        refreshToken: "invalid-refresh-token",
        expiresAt: 1,
      })
      return id
    })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          code: "invalid_grant",
          message: "Invalid\nrefresh token",
        },
        { status: 400 }
      )
    )

    const result = await t
      .withIdentity({ subject: directorId })
      .action(api.integrations.tokens.refreshServiceAccount, {
        service: "canva",
      })

    expect(result).toEqual({
      success: false,
      message:
        "Canva token request failed (HTTP 400, invalid_grant). Invalid refresh token",
    })
  })
})

describe("service account connect flow", () => {
  test("the callback path constant matches the route literal", () => {
    // TanStack Router needs a literal in
    // src/routes/admin/service-accounts/callback.tsx, so the two must be kept
    // in sync by hand.
    expect(SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH).toBe(
      "/admin/service-accounts/callback"
    )
  })

  test("only directors can start a connection", async () => {
    stubCanvaOAuthEnv()
    stubSiteUrl()
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .mutation(api.integrations.serviceAccountConnect.startConnect, {
          service: "canva",
        })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
    await expect(
      t.mutation(api.integrations.serviceAccountConnect.startConnect, {
        service: "canva",
      })
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } })

    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect())
    ).resolves.toEqual([])
  })

  test("starting a PKCE connection stores one attempt and hides the raw state", async () => {
    const t = convexTest(schema, modules)
    const { directorId, authorizeUrl } = await startCanvaConnect(t)

    const url = new URL(authorizeUrl)
    expect(url.origin + url.pathname).toBe(
      "https://www.canva.com/api/oauth/authorize"
    )
    expect(url.searchParams.get("redirect_uri")).toBe(
      EXPECTED_CANVA_REDIRECT_URI
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toBeTruthy()

    const state = stateFromAuthorizeUrl(authorizeUrl)
    const attempts = await t.run(
      async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect()
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      service: "canva",
      createdByUserId: directorId,
    })
    expect(attempts[0]?.codeVerifier).toBeTruthy()
    // Only the hash is persisted, so a leaked callback URL cannot be matched
    // back to a stored row.
    expect(attempts[0]?.stateHash).not.toBe(state)
    expect(JSON.stringify(attempts)).not.toContain(state)
  })

  test("WCA does not use PKCE", async () => {
    stubWcaOAuthEnv()
    stubSiteUrl()
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))

    const { authorizeUrl } = await t
      .withIdentity({ subject: directorId })
      .mutation(api.integrations.serviceAccountConnect.startConnect, {
        service: "wca",
      })

    const url = new URL(authorizeUrl)
    expect(url.searchParams.get("code_challenge")).toBeNull()
    expect(url.searchParams.get("redirect_uri")).toBe(EXPECTED_REDIRECT_URI)

    const attempts = await t.run(
      async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect()
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.codeVerifier).toBeUndefined()
  })

  test("the per-provider loopback host applies only to local development", async () => {
    stubCanvaOAuthEnv()
    vi.stubEnv("SITE_URL", "https://hq.example.test")
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))

    const { authorizeUrl } = await t
      .withIdentity({ subject: directorId })
      .mutation(api.integrations.serviceAccountConnect.startConnect, {
        service: "canva",
      })

    // Deployed origins are never loopback, so every provider shares SITE_URL.
    expect(new URL(authorizeUrl).searchParams.get("redirect_uri")).toBe(
      `https://hq.example.test${SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH}`
    )
  })

  test("the callback page can read the origin it must run on", async () => {
    stubSiteUrl()
    const t = convexTest(schema, modules)

    // Public: the callback page reads it before the director is authenticated.
    await expect(
      t.query(api.integrations.serviceAccountConnect.callbackSiteOrigin, {})
    ).resolves.toBe(SITE_URL)
  })

  test("restarting the same service replaces the earlier attempt", async () => {
    const t = convexTest(schema, modules)
    const { director } = await startCanvaConnect(t)

    await director.mutation(
      api.integrations.serviceAccountConnect.startConnect,
      { service: "canva" }
    )

    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect())
    ).resolves.toHaveLength(1)
  })

  test("completing a connection stores the token, scope, and who connected it", async () => {
    const t = convexTest(schema, modules)
    const { directorId, director, authorizeUrl } = await startCanvaConnect(t)
    await t.run(async (ctx) => {
      await ctx.db.patch("users", directorId, { name: "Dana Director" })
    })
    const expiresIn = 14_400
    const exchangeBodies: URLSearchParams[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init): Promise<Response> => {
        const body = init?.body
        if (body instanceof URLSearchParams) {
          exchangeBodies.push(body)
        }
        return Response.json({
          access_token: "fresh-access-token",
          refresh_token: "fresh-refresh-token",
          expires_in: expiresIn,
          scope: "design:content:write folder:read",
        })
      }
    )

    const result = await director.action(
      api.integrations.serviceAccountConnect.completeConnect,
      { state: stateFromAuthorizeUrl(authorizeUrl), code: "provider-code" }
    )

    expect(result).toMatchObject({
      success: true,
      service: "canva",
      displayName: "Canva",
    })

    // The exchange must send the browser redirect URI and the verifier the
    // browser never saw.
    expect(exchangeBodies).toHaveLength(1)
    const exchange = exchangeBodies[0]
    expect(exchange.get("redirect_uri")).toBe(EXPECTED_CANVA_REDIRECT_URI)
    expect(exchange.get("code_verifier")).toBeTruthy()
    expect(exchange.get("code")).toBe("provider-code")

    const stored = await t.run(
      async (ctx) =>
        await ctx.db
          .query("serviceTokens")
          .withIndex("by_service", (q) => q.eq("service", "canva"))
          .unique()
    )
    expect(stored).toMatchObject({
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token",
      scope: "design:content:write folder:read",
      connectedByUserId: directorId,
    })
    expect(stored?.connectedAt).toBeGreaterThan(0)

    // The attempt is burnt.
    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect())
    ).resolves.toEqual([])

    const accounts = await director.query(
      api.integrations.tokensStore.listServiceAccounts,
      {}
    )
    expect(
      accounts.find((account) => account.service === "canva")
    ).toMatchObject({
      scopes: ["design:content:write", "folder:read"],
      scopesGranted: true,
      connectedBy: { userId: directorId, name: "Dana Director" },
    })
  })

  test("a state cannot be replayed", async () => {
    const t = convexTest(schema, modules)
    const { director, authorizeUrl } = await startCanvaConnect(t)
    const state = stateFromAuthorizeUrl(authorizeUrl)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        access_token: "fresh-access-token",
        refresh_token: "fresh-refresh-token",
        expires_in: 14_400,
      })
    )
    await director.action(
      api.integrations.serviceAccountConnect.completeConnect,
      { state, code: "provider-code" }
    )

    await expect(
      director.action(api.integrations.serviceAccountConnect.completeConnect, {
        state,
        code: "provider-code",
      })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  })

  test("unknown, expired, and foreign states are all rejected alike", async () => {
    const t = convexTest(schema, modules)
    const { director, authorizeUrl } = await startCanvaConnect(t)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(
      director.action(api.integrations.serviceAccountConnect.completeConnect, {
        state: "not-a-real-state",
        code: "provider-code",
      })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

    // Another director cannot finish someone else's flow, and the attempt is
    // destroyed rather than left available to its owner.
    const otherDirectorId = await t.run(async (ctx) => seedDirectorUser(ctx))
    const state = stateFromAuthorizeUrl(authorizeUrl)
    await expect(
      t
        .withIdentity({ subject: otherDirectorId })
        .action(api.integrations.serviceAccountConnect.completeConnect, {
          state,
          code: "provider-code",
        })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      director.action(api.integrations.serviceAccountConnect.completeConnect, {
        state,
        code: "provider-code",
      })
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

    // An expired attempt is refused even by the director that started it.
    const expired = await startCanvaConnect(t)
    await t.run(async (ctx) => {
      for (const attempt of await ctx.db
        .query("serviceOAuthAttempts")
        .collect()) {
        await ctx.db.patch("serviceOAuthAttempts", attempt._id, {
          expiresAt: Date.now() - 1,
        })
      }
    })
    await expect(
      expired.director.action(
        api.integrations.serviceAccountConnect.completeConnect,
        {
          state: stateFromAuthorizeUrl(expired.authorizeUrl),
          code: "provider-code",
        }
      )
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

    // None of these ever reached the provider.
    expect(fetchSpy).not.toHaveBeenCalled()
    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceTokens").collect())
    ).resolves.toEqual([])
  })

  test("a provider failure is reported without storing a token", async () => {
    const t = convexTest(schema, modules)
    const { director, authorizeUrl } = await startCanvaConnect(t)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { code: "invalid_grant", message: "Bad\ncode" },
        { status: 400 }
      )
    )

    const result = await director.action(
      api.integrations.serviceAccountConnect.completeConnect,
      { state: stateFromAuthorizeUrl(authorizeUrl), code: "provider-code" }
    )

    expect(result).toEqual({
      success: false,
      message: "Canva token request failed (HTTP 400, invalid_grant). Bad code",
    })
    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceTokens").collect())
    ).resolves.toEqual([])
  })

  test("directors can disconnect a service account", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceTokens", {
        service: "google",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        expiresAt: 2_000_000_000,
      })
      return id
    })
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
    const director = t.withIdentity({ subject: directorId })

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .mutation(api.integrations.tokensStore.disconnectServiceAccount, {
          service: "google",
        })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })

    await expect(
      director.mutation(api.integrations.tokensStore.disconnectServiceAccount, {
        service: "google",
      })
    ).resolves.toEqual({ disconnected: true })
    await expect(
      t.run(async (ctx) => await ctx.db.query("serviceTokens").collect())
    ).resolves.toEqual([])
    await expect(
      director.mutation(api.integrations.tokensStore.disconnectServiceAccount, {
        service: "google",
      })
    ).resolves.toEqual({ disconnected: false })
  })

  test("CLI-written rows report the configured scope and no connector", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceTokens", {
        service: "google",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        expiresAt: 2_000_000_000,
      })
      return id
    })

    const accounts = await t
      .withIdentity({ subject: directorId })
      .query(api.integrations.tokensStore.listServiceAccounts, {})
    const google = accounts.find((account) => account.service === "google")

    expect(google).toMatchObject({
      connected: true,
      scopesGranted: false,
      connectedBy: null,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    })
    // Falls back to _creationTime for rows written before connectedAt existed.
    expect(google?.connectedAt).toBeGreaterThan(0)
  })

  test("the sweep deletes only expired attempts", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => {
      const id = await seedDirectorUser(ctx)
      await ctx.db.insert("serviceOAuthAttempts", {
        stateHash: "expired-hash",
        service: "canva",
        createdByUserId: id,
        expiresAt: Date.now() - 1,
      })
      await ctx.db.insert("serviceOAuthAttempts", {
        stateHash: "live-hash",
        service: "google",
        createdByUserId: id,
        expiresAt: Date.now() + 60_000,
      })
      return id
    })
    expect(directorId).toBeTruthy()

    await expect(
      t.mutation(
        internal.integrations.serviceAccountConnect.purgeExpiredAttempts,
        {}
      )
    ).resolves.toBe(1)
    const remaining = await t.run(
      async (ctx) => await ctx.db.query("serviceOAuthAttempts").collect()
    )
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.stateHash).toBe("live-hash")
  })
})
