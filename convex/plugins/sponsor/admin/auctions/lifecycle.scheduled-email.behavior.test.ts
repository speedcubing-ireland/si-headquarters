import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import cronsSchema from "../../../../../node_modules/@convex-dev/crons/dist/component/schema.js"
import { modules } from "@/convex/test.setup"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import { seedDirectorUser } from "@/convex/testHelpers"

const cronsModules = import.meta.glob<string[]>(
  "../../../../../node_modules/@convex-dev/crons/dist/component/**/*.js"
)

function createHarness() {
  const t = convexTest(schema, modules)
  t.registerComponent("crons", cronsSchema, cronsModules)
  return t
}

async function seedScheduledAuction(t: ReturnType<typeof convexTest>): Promise<{
  managerId: Id<"users">
  competitionId: Id<"competitions">
  sponsorIds: Id<"sponsors">[]
  auctionId: Id<"sponsorshipAuctions">
}> {
  return t.run(async (ctx) => {
    const managerId = await seedDirectorUser(ctx)
    const competitionId = await insertTestCompetition(ctx, {
      name: "Test Comp",
      from: "2026-09-01",
      to: "2026-09-02",
      organisers: [managerId],
      wcaCompetitionId: "TestComp2026",
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
      state: "draft",
      currency: "EUR",
      startsAt: now + 86_400_000,
      endsAt: now + 172_800_000,
      antiSnipingWindowMs: 300_000,
      antiSnipingExtendMs: 300_000,
      startPriceCents: 10_000,
      competitionSnapshot: {
        summary: {
          name: "Test Comp",
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
    for (const sponsorId of [sponsorA, sponsorB]) {
      await ctx.db.insert("sponsorshipAuctionInvites", {
        auctionId,
        sponsorId,
        invitedById: managerId,
        invitedAt: now,
      })
    }
    return {
      managerId,
      competitionId,
      sponsorIds: [sponsorA, sponsorB],
      auctionId,
    }
  })
}

/**
 * Helper: collect all pending scheduled functions and extract their args.
 * Email batches schedule `sendSponsorshipEmailBatch` via runAfter(0, …).
 */
async function getScheduledEmailArgs(
  t: ReturnType<typeof createHarness>
): Promise<{ emailType: string; recipients: unknown[] }[]> {
  return t.run(async (ctx) => {
    const all = await ctx.db.system.query("_scheduled_functions").collect()
    return all
      .filter((fn) => fn.name.includes("sendSponsorshipEmailBatch"))
      .map((fn) => {
        const args = (fn.args as unknown[])[0] as {
          emailType: string
          recipients: unknown[]
        }
        return { emailType: args.emailType, recipients: args.recipients }
      })
  })
}

describe("auction scheduled email behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("start with future startsAt enqueues auction_scheduled email", async () => {
    const t = createHarness()
    const { managerId, auctionId } = await seedScheduledAuction(t)
    const manager = t.withIdentity({ subject: managerId })

    await manager.mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
      auctionId,
    })

    const auction = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(auction?.state).toBe("scheduled")

    const emails = await getScheduledEmailArgs(t)
    const scheduled = emails.filter((e) => e.emailType === "auction_scheduled")
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].recipients).toHaveLength(2)

    const activationCheck = await t.run(async (ctx) => {
      const auctionRow = await ctx.db.get("sponsorshipAuctions", auctionId)
      const sfId = auctionRow?.activationScheduledFunctionId
      const doc =
        sfId !== undefined
          ? await ctx.db.system.get("_scheduled_functions", sfId)
          : null
      return {
        scheduledTime: doc?.scheduledTime,
        startsAt: auctionRow?.startsAt,
      }
    })
    expect(activationCheck.scheduledTime).toBeDefined()
    expect(activationCheck.scheduledTime).toBe(activationCheck.startsAt)
  }, 10_000)

  test("start with past startsAt enqueues auction_started, not auction_scheduled", async () => {
    const t = createHarness()
    const { managerId, auctionId } = await seedScheduledAuction(t)

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        startsAt: Date.now() - 60_000,
      })
    })

    const manager = t.withIdentity({ subject: managerId })
    await manager.mutation(api.plugins.sponsor.admin.auctions.lifecycle.start, {
      auctionId,
    })

    const auction = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(auction?.state).toBe("active")

    const emails = await getScheduledEmailArgs(t)
    const scheduled = emails.filter((e) => e.emailType === "auction_scheduled")
    const started = emails.filter((e) => e.emailType === "auction_started")
    expect(scheduled).toHaveLength(0)
    expect(started).toHaveLength(1)
    expect(started[0].recipients).toHaveLength(2)
  }, 10_000)

  test("_activateAuction sends auction_started but not auction_scheduled", async () => {
    const t = createHarness()
    const { auctionId } = await seedScheduledAuction(t)

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        state: "scheduled",
        startsAt: Date.now() - 1_000,
      })
    })

    await t.mutation(
      internal.plugins.sponsor.admin.auctions.lifecycle._activateAuction,
      {
        auctionId,
      }
    )

    const auction = await t.run((ctx) =>
      ctx.db.get("sponsorshipAuctions", auctionId)
    )
    expect(auction?.state).toBe("active")

    const emails = await getScheduledEmailArgs(t)
    const scheduled = emails.filter((e) => e.emailType === "auction_scheduled")
    const started = emails.filter((e) => e.emailType === "auction_started")
    expect(scheduled).toHaveLength(0)
    expect(started).toHaveLength(1)
  }, 10_000)
})
