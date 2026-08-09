/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
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
