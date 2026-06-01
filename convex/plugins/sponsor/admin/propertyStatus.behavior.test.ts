import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { TEAM_NAMES } from "@/convex/permissions/constants"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"

async function seedManager(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {})
    await ctx.db.insert("teams", {
      name: TEAM_NAMES.DIRECTORS,
      memberIds: [userId],
    })
    return userId
  })
}

describe("propertyStatus", () => {
  test("not_offered when no auctions exist", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Test Comp",
        from: "2026-06-01",
        to: "2026-06-02",
      }),
    )

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId },
    )
    expect(result.status).toBe("not_offered")
  })

  test("bidding when scheduled auction exists", async () => {
    const t = convexTest(schema, modules)
    const managerId = await seedManager(t)
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Bidding Comp",
        from: "2026-07-01",
        to: "2026-07-02",
        organisers: [managerId],
      }),
    )

    const sponsorId = await manager.mutation(api.plugins.sponsor.admin.sponsors.create, {
      name: "Sponsor",
      email: "sponsor@test.com",
    })

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
      },
    )

    await t.run(async (ctx) => {
      await ctx.db.patch("sponsorshipAuctions", auctionId, {
        state: "scheduled",
      })
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId },
    )
    expect(result.status).toBe("bidding")
  })

  test("manual override takes precedence", async () => {
    const t = convexTest(schema, modules)
    const managerId = await seedManager(t)
    const manager = t.withIdentity({ subject: managerId })

    const competitionId = await t.run(async (ctx) =>
      insertTestCompetition(ctx, {
        name: "Override Comp",
        from: "2026-08-01",
        to: "2026-08-02",
      }),
    )

    await manager.mutation(api.plugins.sponsor.admin.propertyStatus.setManualOverride, {
      competitionId,
      status: "sponsor",
    })

    const result = await t.query(
      api.plugins.sponsor.admin.propertyStatus.getForCompetition,
      { competitionId },
    )
    expect(result.status).toBe("sponsor")
  })
})
