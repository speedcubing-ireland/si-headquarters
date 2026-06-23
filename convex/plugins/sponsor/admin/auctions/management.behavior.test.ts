import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"
import { defaultSponsorshipCurrency } from "@/convex/plugins/sponsor/lib/currency"

async function seedAuctionPrereqs(t: SponsorAuctionTestHarness): Promise<{
  managerId: Id<"users">
  competitionId: Id<"competitions">
  sponsorId: Id<"sponsors">
}> {
  return t.run(async (ctx) => {
    const managerId = await seedDirectorUser(ctx)
    const competitionId = await insertTestCompetition(ctx, {
      name: "Auction Comp",
      from: "2026-09-01",
      to: "2026-09-02",
      organisers: [managerId],
    })
    const sponsorId = await ctx.db.insert("sponsors", {
      name: "Sponsor A",
      email: "sponsor-a@example.com",
      emailNormalized: "sponsor-a@example.com",
      active: true,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: Date.now(),
    })
    return { managerId, competitionId, sponsorId }
  })
}

describe("auction management behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test("create auction stores record in draft state with competition snapshot", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t)
    const manager = t.withIdentity({ subject: managerId })

    const now = Date.now()
    const startPriceCents = 5000
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        startPriceCents,
        invitedSponsorIds: [sponsorId],
      }
    )

    const doc = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(doc?.state).toBe("draft")
    expect(doc?.framework).toBe("first_sealed")
    expect(doc?.currency).toBe(defaultSponsorshipCurrency())
    expect(doc?.startPriceCents).toBe(startPriceCents)
    expect(doc?.competitionSnapshot).toBeTruthy()
    expect(doc?.competitionId).toBe(competitionId)
  })

  test("update changes framework and dates in draft state", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t)
    const manager = t.withIdentity({ subject: managerId })

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
      }
    )

    const newStart = now + 200_000_000
    const newEnd = now + 300_000_000
    await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.update,
      {
        auctionId,
        framework: "vickrey",
        startsAt: newStart,
        endsAt: newEnd,
      }
    )

    const doc = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(doc?.framework).toBe("vickrey")
    expect(doc?.startsAt).toBe(newStart)
    expect(doc?.endsAt).toBe(newEnd)
  })

  test("removeBeforeOpen deletes draft auction", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t)
    const manager = t.withIdentity({ subject: managerId })

    const now = Date.now()
    const auctionId = await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.create,
      {
        competitionId,
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
      }
    )

    await manager.mutation(
      api.plugins.sponsor.admin.auctions.management.removeBeforeOpen,
      { auctionId }
    )

    const doc = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(doc).toBeNull()
  })

  test("removeBeforeOpen rejects active auctions", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, competitionId } = await seedAuctionPrereqs(t)
    const manager = t.withIdentity({ subject: managerId })

    const now = Date.now()
    const auctionId = await t.run(async (ctx) =>
      ctx.db.insert("sponsorshipAuctions", {
        competitionId,
        framework: "first_sealed",
        state: "active",
        currency: "EUR",
        startsAt: now - 86_400_000,
        endsAt: now + 86_400_000,
        antiSnipingWindowMs: 300_000,
        antiSnipingExtendMs: 300_000,
        startPriceCents: 5000,
        competitionSnapshot: {
          summary: {
            name: "Auction Comp",
            address: "",
            startDate: "2026-09-01",
            endDate: "2026-09-02",
            eventIds: [],
          },
          source: "competition_record",
          fetchedAt: now,
        },
        createdById: managerId,
        updatedById: managerId,
        updatedAt: now,
      })
    )

    await expect(
      manager.mutation(
        api.plugins.sponsor.admin.auctions.management.removeBeforeOpen,
        {
          auctionId,
        }
      )
    ).rejects.toBeTruthy()
  })

  test("create rejects non-positive anti-sniping settings", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, competitionId, sponsorId } = await seedAuctionPrereqs(t)
    const manager = t.withIdentity({ subject: managerId })
    const now = Date.now()

    await expect(
      manager.mutation(api.plugins.sponsor.admin.auctions.management.create, {
        competitionId,
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
        antiSnipingWindowMs: 0,
      })
    ).rejects.toBeTruthy()
    await expect(
      manager.mutation(api.plugins.sponsor.admin.auctions.management.create, {
        competitionId,
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        startPriceCents: 5000,
        invitedSponsorIds: [sponsorId],
        antiSnipingExtendMs: -1,
      })
    ).rejects.toBeTruthy()
  })
})
