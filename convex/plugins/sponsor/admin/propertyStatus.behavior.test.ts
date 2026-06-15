import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { insertTestUser, seedDirectorUser } from "@/convex/testHelpers"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"

async function seedSponsor(
  ctx: MutationCtx,
  managerId: Id<"users">,
  input: { name: string; email: string }
): Promise<Id<"sponsors">> {
  return await ctx.db.insert("sponsors", {
    name: input.name,
    email: input.email,
    emailNormalized: input.email.toLowerCase(),
    active: true,
    createdById: managerId,
    updatedById: managerId,
    updatedAt: Date.now(),
  })
}

async function seedAuction(
  t: SponsorAuctionTestHarness,
  input: {
    managerId: Id<"users">
    competitionId: Id<"competitions">
    sponsorId: Id<"sponsors">
    framework?: "first_sealed" | "vickrey" | "ebay_proxy"
    state?: "draft" | "scheduled" | "active" | "closed"
    winnerSponsorId?: Id<"sponsors">
    settlementAmountCents?: number
  }
): Promise<Id<"sponsorshipAuctions">> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      competitionId: input.competitionId,
      framework: input.framework ?? "first_sealed",
      state: input.state ?? "draft",
      currency: "EUR",
      startsAt: now - 120_000,
      endsAt: now + 120_000,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 5_000,
      competitionSnapshot: {
        summary: {
          name: "Property Status Comp",
          address: "",
          startDate: "2026-09-01",
          endDate: "2026-09-02",
          eventIds: [],
        },
        source: "competition_record",
        fetchedAt: now,
      },
      createdById: input.managerId,
      updatedById: input.managerId,
      updatedAt: now,
      ...(input.winnerSponsorId
        ? { winnerSponsorId: input.winnerSponsorId }
        : {}),
      ...(input.settlementAmountCents !== undefined
        ? { settlementAmountCents: input.settlementAmountCents }
        : {}),
    })
    await ctx.db.insert("sponsorshipAuctionInvites", {
      auctionId,
      sponsorId: input.sponsorId,
      invitedById: input.managerId,
      invitedAt: now,
    })
    return auctionId
  })
}

describe("propertyStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test("not_offered when no auctions exist", async () => {
    const t = createSponsorAuctionTestHarness()
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })
    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Test Comp",
        from: "2026-06-01",
        to: "2026-06-02",
      })
    )

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("not_offered")
    expect(result.isManualOverride).toBe(false)
  })

  test("bidding when scheduled auction exists", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const sponsorId = await t.run((ctx) =>
      seedSponsor(ctx, managerId, {
        name: "Sponsor",
        email: "sponsor@test.com",
      })
    )

    await seedAuction(t, {
      managerId,
      competitionId,
      framework: "ebay_proxy",
      state: "scheduled",
      sponsorId,
    })

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("bidding")
  })

  test("bidding when draft auction exists", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const sponsorId = await t.run((ctx) =>
      seedSponsor(ctx, managerId, {
        name: "Sponsor",
        email: "draft-sponsor@test.com",
      })
    )

    const auctionId = await seedAuction(t, {
      managerId,
      competitionId,
      framework: "ebay_proxy",
      state: "draft",
      sponsorId,
    })

    await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      expect(auction?.state).toBe("draft")
    })

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("bidding")
  })

  test("none only when all auctions are closed without a winner", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const sponsorId = await t.run((ctx) =>
      seedSponsor(ctx, managerId, {
        name: "Sponsor",
        email: "no-winner@test.com",
      })
    )

    await seedAuction(t, {
      managerId,
      competitionId,
      framework: "first_sealed",
      state: "closed",
      sponsorId,
    })

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("none")
  })

  test("clearing manual override returns to auction-derived status", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("not_offered")
    expect(result.isManualOverride).toBe(false)
  })

  test("manual override takes precedence", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("sponsor")
    expect(result.isManualOverride).toBe(true)
  })

  test("returns winner sponsor name from closed auction", async () => {
    const t = createSponsorAuctionTestHarness()
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

    const sponsorId = await t.run((ctx) =>
      seedSponsor(ctx, managerId, {
        name: "Acme Cubes",
        email: "acme@test.com",
      })
    )

    await seedAuction(t, {
      managerId,
      competitionId,
      framework: "first_sealed",
      state: "closed",
      sponsorId,
      winnerSponsorId: sponsorId,
      settlementAmountCents: 7_500,
    })

    const result = await manager.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("sponsor")
    expect(result.winnerSponsorName).toBe("Acme Cubes")
    expect(result.settlementAmountCents).toBe(7500)
    expect(result.isManualOverride).toBe(false)
  })

  test("competition organisers can read sponsor status without bid details", async () => {
    const t = createSponsorAuctionTestHarness()
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const organiserId = await t.run((ctx) => insertTestUser(ctx, "Organiser"))
    const organiser = t.withIdentity({ subject: organiserId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Organiser Visible Sponsor Comp",
        from: "2026-09-01",
        to: "2026-09-02",
        organisers: [organiserId],
      })
    )

    const sponsorId = await t.run((ctx) =>
      seedSponsor(ctx, managerId, {
        name: "Visible Sponsor",
        email: "visible@test.com",
      })
    )

    await seedAuction(t, {
      managerId,
      competitionId,
      framework: "first_sealed",
      state: "closed",
      sponsorId,
      winnerSponsorId: sponsorId,
      settlementAmountCents: 7_500,
    })

    const result = await organiser.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId }
    )
    expect(result.status).toBe("sponsor")
    expect(result.winnerSponsorName).toBe("Visible Sponsor")
    expect(result.winnerSponsorId).toBeUndefined()
    expect(result.settlementAmountCents).toBeUndefined()
    expect(result.isManualOverride).toBe(false)
  })
})
