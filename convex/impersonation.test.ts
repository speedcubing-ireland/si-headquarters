/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, components, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import {
  addUserToTeam,
  insertTestUser,
  seedDirectorUser,
  seedVolunteerTestUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import {
  createSponsorTestHarness,
  seedSponsorSession,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

function tokenFromUrl(url: string): string {
  const token = new URL(url).searchParams.get("token")
  if (token === null) {
    throw new Error("Missing token")
  }
  return token
}

describe("admin impersonation", () => {
  test("directors can create and redeem user impersonation links", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })

    const link = await director.mutation(api.impersonation.mutations.createUserLink, {
      userId: targetUserId,
      reason: "Support request",
    })
    const redeemed = await t.mutation(
      internal.impersonation.internal.redeemUserTokenForAuth,
      { token: tokenFromUrl(link.url) }
    )

    if (redeemed === null) {
      throw new Error("Expected impersonation token to redeem")
    }
    expect(redeemed.userId).toBe(targetUserId)
    const authSession = await t.run((ctx) =>
      ctx.db.get("authSessions", redeemed.sessionId)
    )
    expect(authSession?.userId).toBe(targetUserId)
    expect(authSession?.impersonatedByUserId).toBe(directorId)
    expect(authSession?.expirationTime).toBe(link.sessionExpiresAt)
  })

  test("non-directors cannot create impersonation links", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, targetUserId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { volunteerId, targetUserId }
    })
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.mutation(api.impersonation.mutations.createUserLink, {
        userId: targetUserId,
        reason: "Support request",
      })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("user impersonation links are single use", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })
    const link = await director.mutation(api.impersonation.mutations.createUserLink, {
      userId: targetUserId,
      reason: "Support request",
    })
    const token = tokenFromUrl(link.url)

    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token,
      })
    ).not.toBeNull()
    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token,
      })
    ).toBeNull()
  })

  test("expired user impersonation links cannot be redeemed", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })
    const link = await director.mutation(api.impersonation.mutations.createUserLink, {
      userId: targetUserId,
      reason: "Support request",
    })

    await t.run(async (ctx) => {
      const [ticket] = await ctx.db.query("impersonationSessions").collect()
      await ctx.db.patch("impersonationSessions", ticket._id, {
        ticketExpiresAt: Date.now() - 1,
      })
    })

    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token: tokenFromUrl(link.url),
      })
    ).toBeNull()
  })

  test("disabled users cannot be impersonated", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Disabled User")
      await ctx.db.patch("users", targetUserId, { disabled: true })
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })

    await expect(
      director.mutation(api.impersonation.mutations.createUserLink, {
        userId: targetUserId,
        reason: "Support request",
      })
    ).rejects.toMatchObject({
      data: { code: "NOT_FOUND" },
    })
  })

  test("directors can redeem sponsor impersonation links into sponsor sessions", async () => {
    const t = createSponsorTestHarness()
    const { sponsorId } = await seedSponsorSession(t)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))
    const director = t.withIdentity({ subject: directorId })

    const link = await director.mutation(api.impersonation.mutations.createSponsorLink, {
      sponsorId,
      reason: "Support request",
    })
    const redeemed = await t.mutation(api.impersonation.mutations.redeemSponsorToken, {
      token: tokenFromUrl(link.url),
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- adapter boundary
    const session: object | null = await t.query(
      components.sponsorAuth.adapter.findOne,
      {
        model: "session",
        where: [{ field: "token", value: redeemed.sessionToken }],
      }
    )

    expect(redeemed.sessionExpiresAt).toBe(link.sessionExpiresAt)
    expect(session).toMatchObject({
      token: redeemed.sessionToken,
      expiresAt: link.sessionExpiresAt,
      impersonatedByUserId: directorId,
    })
  })

  test("inactive sponsors cannot be impersonated", async () => {
    const t = createSponsorTestHarness()
    const { sponsorId } = await seedSponsorSession(t)
    const directorId = await t.run(async (ctx) => {
      await ctx.db.patch("sponsors", sponsorId, { active: false })
      return await seedDirectorUser(ctx)
    })
    const director = t.withIdentity({ subject: directorId })

    await expect(
      director.mutation(api.impersonation.mutations.createSponsorLink, {
        sponsorId,
        reason: "Support request",
      })
    ).rejects.toMatchObject({
      data: { code: "NOT_FOUND" },
    })
  })

  test("finance team cannot create impersonation links without director membership", async () => {
    const t = convexTest(schema, modules)
    const { financeId, targetUserId } = await t.run(async (ctx) => {
      const financeId = await insertTestUser(ctx, "Finance User")
      await addUserToTeam(ctx, financeId, TEAM_NAMES.FINANCE)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { financeId, targetUserId }
    })
    const finance = t.withIdentity({ subject: financeId })

    await expect(
      finance.mutation(api.impersonation.mutations.createUserLink, {
        userId: targetUserId,
        reason: "Support request",
      })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })
})
