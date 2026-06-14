import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"
import { syncAuctionActiveReminders } from "./reminders"
import { scheduleAuctionClosure } from "./lifecycle"

async function seedActiveAuction(t: SponsorAuctionTestHarness): Promise<{
  managerId: Id<"users">
  sponsorIds: Id<"sponsors">[]
  auctionId: Id<"sponsorshipAuctions">
}> {
  return t.run(async (ctx) => {
    const managerId = await seedDirectorUser(ctx)
    const competitionId = await insertTestCompetition(ctx, {
      name: "Repair Comp",
      from: "2026-09-01",
      to: "2026-09-02",
      organisers: [managerId],
      wcaCompetitionId: "RepairComp2026",
    })
    const sponsorA = await ctx.db.insert("sponsors", {
      name: "Sponsor A",
      email: "a@example.com",
      emailNormalized: "a@example.com",
      active: true,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: Date.now(),
    })
    const sponsorB = await ctx.db.insert("sponsors", {
      name: "Sponsor B",
      email: "b@example.com",
      emailNormalized: "b@example.com",
      active: true,
      createdById: managerId,
      updatedById: managerId,
      updatedAt: Date.now(),
    })
    const now = Date.now()
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      competitionId,
      framework: "first_sealed",
      state: "active",
      currency: "EUR",
      startsAt: now - 86_400_000,
      endsAt: now + 172_800_000,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 10_000,
      competitionSnapshot: {
        summary: {
          name: "Repair Comp",
          address: "",
          startDate: "2026-09-01",
          endDate: "2026-09-02",
          eventIds: [],
        },
        source: "wca",
        fetchedAt: now,
      },
      createdById: managerId,
      updatedById: managerId,
      updatedAt: now,
    })
    await ctx.db.insert("sponsorshipAuctionInvites", {
      auctionId,
      sponsorId: sponsorA,
      invitedById: managerId,
      invitedAt: now,
    })
    await ctx.db.insert("sponsorshipAuctionInvites", {
      auctionId,
      sponsorId: sponsorB,
      invitedById: managerId,
      invitedAt: now,
    })
    return { managerId, sponsorIds: [sponsorA, sponsorB], auctionId }
  })
}

describe("repairSchedules", () => {
  test("repairs orphaned closure and reminder jobs for an active auction", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId } = await seedActiveAuction(t)

    const previousSchedules = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await scheduleAuctionClosure(ctx, auction)
      await syncAuctionActiveReminders(ctx, auction, { reset: true })
      const scheduled = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!scheduled?.closureScheduledFunctionId) {
        throw new Error("expected closure schedule")
      }
      await ctx.scheduler.cancel(scheduled.closureScheduledFunctionId)

      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
        .collect()
      for (const reminder of reminders) {
        if (reminder.scheduledFunctionId !== undefined) {
          await ctx.scheduler.cancel(reminder.scheduledFunctionId)
        }
      }
      return {
        closureId: scheduled.closureScheduledFunctionId,
        reminders,
      }
    })

    const manager = t.withIdentity({ subject: managerId })
    await manager.mutation(
      api.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      { auctionId }
    )

    const repaired = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
        .collect()
      return { auction, reminders }
    })
    expect(repaired.auction?.closureScheduledFunctionId).toBeDefined()
    expect(repaired.auction?.closureScheduledFunctionId).not.toBe(
      previousSchedules.closureId
    )
    for (const reminder of repaired.reminders) {
      const previous = previousSchedules.reminders.find(
        (candidate) => candidate._id === reminder._id
      )
      expect(reminder.scheduledFunctionId).toBeDefined()
      expect(reminder.scheduledFunctionId).not.toBe(
        previous?.scheduledFunctionId
      )
    }
  })

  test("creates missing reminder rows when activation scheduling was lost", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, sponsorIds, auctionId } = await seedActiveAuction(t)

    const manager = t.withIdentity({ subject: managerId })
    await manager.mutation(
      api.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      { auctionId }
    )

    const repaired = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
        .collect()
      return { auction, reminders }
    })
    expect(repaired.auction?.closureScheduledFunctionId).toBeDefined()
    expect(repaired.reminders).toHaveLength(sponsorIds.length)
    for (const reminder of repaired.reminders) {
      expect(reminder.scheduledFunctionId).toBeDefined()
    }
  })

  test("repairs all scheduled and active auctions when auctionId is omitted", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId: activeAuctionId } = await seedActiveAuction(t)
    const scheduledAuctionId = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", activeAuctionId)
      if (!auction) throw new Error("auction not found")
      const now = Date.now()
      return await ctx.db.insert("sponsorshipAuctions", {
        competitionId: auction.competitionId,
        framework: "first_sealed",
        state: "scheduled",
        currency: "EUR",
        startsAt: now + 86_400_000,
        endsAt: now + 172_800_000,
        antiSnipingWindowMs: 300_000,
        antiSnipingExtendMs: 300_000,
        startPriceCents: 10_000,
        competitionSnapshot: auction.competitionSnapshot,
        createdById: auction.createdById,
        updatedById: auction.updatedById,
        updatedAt: now,
      })
    })

    const manager = t.withIdentity({ subject: managerId })
    await manager.mutation(
      api.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    const repaired = await t.run(async (ctx) => {
      const [activeAuction, scheduledAuction] = await Promise.all([
        ctx.db.get("sponsorshipAuctions", activeAuctionId),
        ctx.db.get("sponsorshipAuctions", scheduledAuctionId),
      ])
      return { activeAuction, scheduledAuction }
    })
    expect(repaired.activeAuction?.closureScheduledFunctionId).toBeDefined()
    expect(
      repaired.scheduledAuction?.activationScheduledFunctionId
    ).toBeDefined()
  })
})
