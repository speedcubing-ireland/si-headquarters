import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"
import { syncAuctionActiveReminders } from "./reminders"
import { scheduleAuctionClosure } from "./lifecycle"

async function seedActiveAuction(t: SponsorAuctionTestHarness): Promise<{
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
    return { sponsorIds: [sponsorA, sponsorB], auctionId }
  })
}

async function getScheduledDispatchIds(
  t: SponsorAuctionTestHarness
): Promise<Id<"sponsorshipEmailDispatches">[]> {
  return await t.run(async (ctx) => {
    const scheduled = await ctx.db.system
      .query("_scheduled_functions")
      .collect()
    return scheduled
      .filter((entry) =>
        entry.name.includes("processSponsorshipEmailDispatches")
      )
      .flatMap((entry) => {
        const [args] = entry.args as [
          { dispatchIds?: Id<"sponsorshipEmailDispatches">[] },
        ]
        return args.dispatchIds ?? []
      })
  })
}

describe("repairSchedules", () => {
  test("repairs orphaned closure and reminder jobs for an active auction", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId } = await seedActiveAuction(t)

    const previousSchedules = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await scheduleAuctionClosure(ctx, auction)
      await syncAuctionActiveReminders(ctx, auction, { createMissing: true })
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

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
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
    const { sponsorIds, auctionId } = await seedActiveAuction(t)

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
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

  test("replaces schedules that no longer match the auction end", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId } = await seedActiveAuction(t)

    const previous = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      if (!auction) throw new Error("auction not found")
      await scheduleAuctionClosure(ctx, auction)
      await syncAuctionActiveReminders(ctx, auction, { createMissing: true })

      const scheduledAuction = await ctx.db.get(
        "sponsorshipAuctions",
        auctionId
      )
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
        .collect()
      const endsAt = auction.endsAt + 30 * 60_000
      await ctx.db.patch("sponsorshipAuctions", auctionId, { endsAt })
      return { scheduledAuction, reminders, endsAt }
    })

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    const repaired = await t.run(async (ctx) => {
      const auction = await ctx.db.get("sponsorshipAuctions", auctionId)
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
        .collect()
      return { auction, reminders }
    })

    expect(repaired.auction?.closureScheduledFunctionId).not.toBe(
      previous.scheduledAuction?.closureScheduledFunctionId
    )
    for (const reminder of repaired.reminders) {
      const oldReminder = previous.reminders.find(
        (candidate) => candidate._id === reminder._id
      )
      if (!oldReminder) throw new Error("previous reminder not found")
      expect(reminder.scheduledFor).toBe(previous.endsAt - 60 * 60_000)
      expect(reminder.scheduledFunctionId).not.toBe(
        oldReminder.scheduledFunctionId
      )
    }
  })

  test("repairs all open auctions without replacing valid schedules", async () => {
    const t = createSponsorAuctionTestHarness()
    const { auctionId: activeAuctionId } = await seedActiveAuction(t)
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

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    const firstRepair = await t.run(async (ctx) => {
      const [activeAuction, scheduledAuction] = await Promise.all([
        ctx.db.get("sponsorshipAuctions", activeAuctionId),
        ctx.db.get("sponsorshipAuctions", scheduledAuctionId),
      ])
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", activeAuctionId))
        .collect()
      return { activeAuction, scheduledAuction, reminders }
    })
    expect(firstRepair.activeAuction?.closureScheduledFunctionId).toBeDefined()
    expect(
      firstRepair.scheduledAuction?.activationScheduledFunctionId
    ).toBeDefined()

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    const secondRepair = await t.run(async (ctx) => {
      const [activeAuction, scheduledAuction] = await Promise.all([
        ctx.db.get("sponsorshipAuctions", activeAuctionId),
        ctx.db.get("sponsorshipAuctions", scheduledAuctionId),
      ])
      const reminders = await ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", activeAuctionId))
        .collect()
      return { activeAuction, scheduledAuction, reminders }
    })

    expect(secondRepair.activeAuction?.closureScheduledFunctionId).toBe(
      firstRepair.activeAuction?.closureScheduledFunctionId
    )
    expect(secondRepair.scheduledAuction?.activationScheduledFunctionId).toBe(
      firstRepair.scheduledAuction?.activationScheduledFunctionId
    )
    expect(
      secondRepair.reminders.map((reminder) => reminder.scheduledFunctionId)
    ).toEqual(
      firstRepair.reminders.map((reminder) => reminder.scheduledFunctionId)
    )
  })

  test("re-drives due pending email dispatch rows", async () => {
    const t = createSponsorAuctionTestHarness()
    const dispatchId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert("sponsorshipEmailDispatches", {
        dedupKey: "repair-pending",
        emailType: "invite",
        recipientEmail: "sponsor@example.com",
        subject: "Sponsor portal access",
        message: "Open the portal",
        status: "pending",
        attempts: 0,
        createdAt: now - 10 * 60_000,
        nextAttemptAt: now - 1_000,
      })
    })

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    await expect(getScheduledDispatchIds(t)).resolves.toContain(dispatchId)
  })

  test("does not re-drive pending dispatch rows before nextAttemptAt", async () => {
    const t = createSponsorAuctionTestHarness()
    const dispatchId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert("sponsorshipEmailDispatches", {
        dedupKey: "repair-future",
        emailType: "invite",
        recipientEmail: "sponsor@example.com",
        subject: "Sponsor portal access",
        message: "Open the portal",
        status: "pending",
        attempts: 0,
        createdAt: now - 10 * 60_000,
        nextAttemptAt: now + 60_000,
      })
    })

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    await expect(getScheduledDispatchIds(t)).resolves.not.toContain(dispatchId)
  })

  test("releases stale processing email dispatch rows", async () => {
    const t = createSponsorAuctionTestHarness()
    const dispatchId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert("sponsorshipEmailDispatches", {
        dedupKey: "repair-processing",
        emailType: "invite",
        recipientEmail: "sponsor@example.com",
        subject: "Sponsor portal access",
        message: "Open the portal",
        status: "processing",
        attempts: 0,
        createdAt: now - 20 * 60_000,
        processingStartedAt: now - 11 * 60_000,
      })
    })

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle.repairSchedules,
      {}
    )

    const repaired = await t.run(async (ctx) => {
      return await ctx.db.get("sponsorshipEmailDispatches", dispatchId)
    })
    expect(repaired).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "Processing lease expired before delivery completed.",
    })
    expect(repaired?.processingStartedAt).toBeUndefined()
    expect(repaired?.nextAttemptAt).toBeTypeOf("number")
    await expect(getScheduledDispatchIds(t)).resolves.toContain(dispatchId)
  })
})
