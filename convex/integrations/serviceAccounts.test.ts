/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { seedDirectorUser, seedVolunteerTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

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
})
