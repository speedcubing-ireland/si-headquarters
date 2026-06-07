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

const TEST_CONSUMPTION_NONCE = "nonce-fixed-for-strict-mode-1234"
const OTHER_CONSUMPTION_NONCE = "another-nonce-different-5678"

describe("admin impersonation", () => {
  test("directors can create and redeem user impersonation links", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })

    const link = await director.mutation(
      api.impersonation.mutations.createUserLink,
      {
        userId: targetUserId,
        reason: "Support request",
      }
    )
    const redeemed = await t.mutation(
      internal.impersonation.internal.redeemUserTokenForAuth,
      {
        token: tokenFromUrl(link.url),
        consumptionNonce: TEST_CONSUMPTION_NONCE,
      }
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

  test("user impersonation redeem is idempotent for the same consumption nonce", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })
    const link = await director.mutation(
      api.impersonation.mutations.createUserLink,
      {
        userId: targetUserId,
        reason: "Support request",
      }
    )
    const token = tokenFromUrl(link.url)

    const first = await t.mutation(
      internal.impersonation.internal.redeemUserTokenForAuth,
      { token, consumptionNonce: TEST_CONSUMPTION_NONCE }
    )
    const second = await t.mutation(
      internal.impersonation.internal.redeemUserTokenForAuth,
      { token, consumptionNonce: TEST_CONSUMPTION_NONCE }
    )

    if (first === null || second === null) {
      throw new Error("Expected impersonation token to redeem")
    }
    expect(first.userId).toBe(targetUserId)
    expect(second.userId).toBe(targetUserId)
    expect(second.sessionId).toBe(first.sessionId)
  })

  test("user impersonation blocks replay with a different consumption nonce", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })
    const link = await director.mutation(
      api.impersonation.mutations.createUserLink,
      {
        userId: targetUserId,
        reason: "Support request",
      }
    )
    const token = tokenFromUrl(link.url)

    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token,
        consumptionNonce: TEST_CONSUMPTION_NONCE,
      })
    ).not.toBeNull()
    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token,
        consumptionNonce: OTHER_CONSUMPTION_NONCE,
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
    const link = await director.mutation(
      api.impersonation.mutations.createUserLink,
      {
        userId: targetUserId,
        reason: "Support request",
      }
    )

    await t.run(async (ctx) => {
      const [ticket] = await ctx.db.query("impersonationSessions").collect()
      await ctx.db.patch("impersonationSessions", ticket._id, {
        ticketExpiresAt: Date.now() - 1,
      })
    })

    expect(
      await t.mutation(internal.impersonation.internal.redeemUserTokenForAuth, {
        token: tokenFromUrl(link.url),
        consumptionNonce: TEST_CONSUMPTION_NONCE,
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

    const link = await director.mutation(
      api.impersonation.mutations.createSponsorLink,
      {
        sponsorId,
        reason: "Support request",
      }
    )
    const redeemed = await t.mutation(
      api.impersonation.mutations.redeemSponsorToken,
      {
        token: tokenFromUrl(link.url),
      }
    )
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

  test("directors can impersonate a specific sponsor contact", async () => {
    const t = createSponsorTestHarness()
    const { sponsorId, ownerId } = await seedSponsorSession(t)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))
    const director = t.withIdentity({ subject: directorId })

    const ccAuthUser = (await t.mutation(
      components.sponsorAuth.adapter.create,
      {
        input: {
          model: "user",
          data: {
            email: "finance-cc@example.com",
            name: "Finance CC",
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      }
    )) as { _id: string }
    const ccContactId = await t.run(async (ctx) =>
      ctx.db.insert("sponsorContacts", {
        sponsorId,
        name: "Finance CC",
        email: "finance-cc@example.com",
        emailNormalized: "finance-cc@example.com",
        authUserId: ccAuthUser._id,
        active: true,
        isPrimary: false,
        receivesCc: true,
        portalAccess: true,
        canBid: false,
        createdById: ownerId,
        updatedById: ownerId,
        updatedAt: Date.now(),
      })
    )

    const link = await director.mutation(
      api.impersonation.mutations.createSponsorLink,
      {
        sponsorId,
        contactId: ccContactId,
        reason: "Support request",
      }
    )
    const redeemed = await t.mutation(
      api.impersonation.mutations.redeemSponsorToken,
      {
        token: tokenFromUrl(link.url),
      }
    )

    expect(redeemed.sponsorName).toBe("Finance CC")
    const me = await t.query(api.plugins.sponsor.portal.auth.me, {
      sessionToken: redeemed.sessionToken,
    })
    expect(me?.contact?.email).toBe("finance-cc@example.com")
    expect(me?.permissions.canBid).toBe(false)
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
