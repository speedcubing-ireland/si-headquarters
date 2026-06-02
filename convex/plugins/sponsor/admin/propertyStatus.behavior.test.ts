import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"

describe("propertyStatus", () => {
  test("not_offered when no auctions exist", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Test Comp",
        from: "2026-06-01",
        to: "2026-06-02",
      })
    )

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("not_offered")
    expect(result.isManualOverride).toBe(false)
  })

  test("bidding when scheduled auction exists", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Bidding Comp",
        from: "2026-07-01",
        to: "2026-07-02",
        organisers: [managerId],
      })
    )

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Sponsor",
        email: "sponsor@test.com",
      }
    )

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        framework: "ebay_proxy",
        startsAt: now + 60_000,
        endsAt: now + 120_000,
        startPriceCents: 1000,
        invitedSponsorIds: [sponsorId],
      }
    )

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        state: "scheduled",
      })
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("bidding")
  })

  test("bidding when draft auction exists", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Draft Comp",
        from: "2026-07-15",
        to: "2026-07-16",
        organisers: [managerId],
      })
    )

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Sponsor",
        email: "draft-sponsor@test.com",
      }
    )

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        framework: "ebay_proxy",
        startsAt: now + 60_000,
        endsAt: now + 120_000,
        startPriceCents: 1000,
        invitedSponsorIds: [sponsorId],
      }
    )

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      expect(auction?.state).toBe("draft")
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("bidding")
  })

  test("none only when all auctions are closed without a winner", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "No Winner Comp",
        from: "2026-10-01",
        to: "2026-10-02",
        organisers: [managerId],
      })
    )

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Sponsor",
        email: "no-winner@test.com",
      }
    )

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        framework: "first_sealed",
        startsAt: now - 120_000,
        endsAt: now - 60_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
      }
    )

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        state: "closed",
        winnerSponsorId: undefined,
        settlementAmountCents: undefined,
      })
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("none")
  })

  test("clearing manual override returns to auction-derived status", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Clear Override Comp",
        from: "2026-08-15",
        to: "2026-08-16",
      })
    )

    await manager.mutation(
      api.plugins.sponsor.admin.propertyStatus.setManualOverride,
      {
        competitionId,
        status: "none",
        manualSponsorId: null,
      }
    )

    await manager.mutation(
      api.plugins.sponsor.admin.propertyStatus.setManualOverride,
      {
        competitionId,
        status: null,
        manualSponsorId: null,
      }
    )

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("not_offered")
    expect(result.isManualOverride).toBe(false)
  })

  test("manual override takes precedence", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Override Comp",
        from: "2026-08-01",
        to: "2026-08-02",
      })
    )

    await manager.mutation(
      api.plugins.sponsor.admin.propertyStatus.setManualOverride,
      {
        competitionId,
        status: "sponsor",
      }
    )

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("sponsor")
    expect(result.isManualOverride).toBe(true)
  })

  test("returns winner sponsor name from closed auction", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Winner Comp",
        from: "2026-09-01",
        to: "2026-09-02",
        organisers: [managerId],
      })
    )

    const sponsorId = await manager.mutation(
      api.plugins.sponsor.admin.sponsors.create,
      {
        name: "Acme Cubes",
        email: "acme@test.com",
      }
    )

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        framework: "first_sealed",
        startsAt: now - 120_000,
        endsAt: now - 60_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
      }
    )

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        state: "closed",
        winnerSponsorId: sponsorId,
        settlementAmountCents: 7500,
      })
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("sponsor")
    expect(result.winnerSponsorName).toBe("Acme Cubes")
    expect(result.settlementAmountCents).toBe(7500)
    expect(result.isManualOverride).toBe(false)
  })
})
