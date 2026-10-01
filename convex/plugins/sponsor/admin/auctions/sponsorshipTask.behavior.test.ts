import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { api, internal } from "@/convex/_generated/api"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import {
  insertCompetitionPhase,
  insertSeedTask,
  seedDirectorUser,
} from "@/convex/testHelpers"
import { SPONSORSHIP_TASK_TEMPLATE_KEY } from "@/convex/templates/registry"
import {
  createSponsorAuctionTestHarness,
  type SponsorAuctionTestHarness,
} from "@/convex/plugins/sponsor/testing/auctionTestHarness.testSupport"
import { sponsorshipTaskDueDate } from "./sponsorshipTask"

const NOW = Date.UTC(2026, 9, 1, 12, 0)
// 23:30 UTC on 10 October is 00:30 on 11 October in Dublin (IST, UTC+1).
const ENDS_AT = Date.UTC(2026, 9, 10, 23, 30)

async function seedAuction(
  t: SponsorAuctionTestHarness,
  options: {
    startsAt: number
    subject?: Pick<
      Doc<"sponsorshipAuctions">,
      "subjectKind" | "wcaCompetitionId" | "customOffering"
    >
    sponsorshipTemplateKey?: string
  }
): Promise<{
  managerId: Id<"users">
  auctionId: Id<"sponsorshipAuctions">
  taskId: Id<"tasks">
}> {
  return t.run(async (ctx) => {
    const managerId = await seedDirectorUser(ctx)
    const competitionId = await insertTestCompetition(ctx, {
      name: "Test Comp",
      from: "2026-12-01",
      to: "2026-12-02",
      organisers: [managerId],
      wcaCompetitionId: "TestComp2026",
    })
    const phaseId = await insertCompetitionPhase(
      ctx,
      competitionId,
      "Pre-Announcement",
      "a0",
      "red",
      "pre-announcement"
    )
    const taskId = await insertSeedTask(ctx, {
      name: "Sponsorship",
      parent: { type: "phases", id: phaseId },
      order: "a0",
      status: "to-do",
      templateKey:
        options.sponsorshipTemplateKey ?? SPONSORSHIP_TASK_TEMPLATE_KEY,
    })
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      competitionId,
      ...options.subject,
      framework: "first_sealed",
      state: "draft",
      currency: "EUR",
      startsAt: options.startsAt,
      endsAt: ENDS_AT,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 10_000,
      competitionSnapshot: {
        summary: {
          name: "Test Comp",
          address: "",
          startDate: "2026-12-01",
          endDate: "2026-12-02",
          eventIds: [],
        },
        source: "wca",
        fetchedAt: NOW,
      },
      createdById: managerId,
      updatedById: managerId,
      updatedAt: NOW,
    })
    return { managerId, auctionId, taskId }
  })
}

async function getTask(t: SponsorAuctionTestHarness, taskId: Id<"tasks">) {
  return t.run((ctx) => ctx.db.get("tasks", taskId))
}

describe("sponsorship task due date", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test("is the day after the auction ends in the organisation's timezone", () => {
    expect(sponsorshipTaskDueDate(ENDS_AT)).toBe("2026-10-12")
    expect(sponsorshipTaskDueDate(Date.UTC(2026, 9, 10, 12, 0))).toBe(
      "2026-10-11"
    )
  })

  test("moves when an auction opens immediately", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId, taskId } = await seedAuction(t, {
      startsAt: NOW - 60_000,
    })

    await t
      .withIdentity({ subject: managerId })
      .mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
        auctionId,
      })

    expect((await getTask(t, taskId))?.dueDate).toBe("2026-10-12")
  })

  test("moves only once a scheduled auction becomes active", async () => {
    const t = createSponsorAuctionTestHarness()
    const startsAt = NOW + 86_400_000
    const { managerId, auctionId, taskId } = await seedAuction(t, {
      startsAt,
    })

    await t
      .withIdentity({ subject: managerId })
      .mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
        auctionId,
      })
    expect((await getTask(t, taskId))?.dueDate).toBeNull()

    vi.setSystemTime(startsAt)
    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle._activateAuction,
      { auctionId }
    )
    expect((await getTask(t, taskId))?.dueDate).toBe("2026-10-12")
  })

  test("closing the auction leaves the task status alone", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId, taskId } = await seedAuction(t, {
      startsAt: NOW - 60_000,
    })
    const manager = t.withIdentity({ subject: managerId })

    await manager.mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
      auctionId,
    })
    await manager.mutation(api.plugins.sponsor.admin.auctions.lifecycle.close, {
      auctionId,
    })

    const task = await getTask(t, taskId)
    expect(task?.status).toBe("to-do")
    expect(task?.dueDate).toBe("2026-10-12")
  })

  test("ignores tasks not created from the Sponsorship template task", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId, taskId } = await seedAuction(t, {
      startsAt: NOW - 60_000,
      sponsorshipTemplateKey: "schedule-made",
    })

    await t
      .withIdentity({ subject: managerId })
      .mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
        auctionId,
      })

    expect((await getTask(t, taskId))?.dueDate).toBeNull()
  })

  test("custom auctions do not touch competition tasks", async () => {
    const t = createSponsorAuctionTestHarness()
    const { managerId, auctionId, taskId } = await seedAuction(t, {
      startsAt: NOW - 60_000,
      subject: {
        subjectKind: "custom",
        customOffering: { name: "Banner", descriptionMarkdown: "" },
      },
    })

    await t
      .withIdentity({ subject: managerId })
      .mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
        auctionId,
      })

    expect((await getTask(t, taskId))?.dueDate).toBeNull()
  })
})
