import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import { insertTestCompetition } from "@/convex/plugins/sponsor/testing/testHelpers"
import {
  createSponsorTestHarness,
  seedSponsorSession,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

describe("sponsor portal sponsorships", () => {
  test("includes manual sponsor assignments without an auction", async () => {
    const t = createSponsorTestHarness()
    const { sessionToken, sponsorId, ownerId } = await seedSponsorSession(t)
    const competitionId = await t.run((ctx) =>
      insertTestCompetition(ctx, {
        name: "Manual Sponsor Open",
        from: "2026-09-05",
        to: "2026-09-06",
        organisers: [ownerId],
      })
    )

    await t.run((ctx) =>
      ctx.db.insert("competitionSponsorOverrides", {
        competitionId,
        manualSponsorId: sponsorId,
        manualSponsorPropertyStatus: "sponsor",
        updatedById: ownerId,
        updatedAt: Date.now(),
      })
    )

    const sponsorships = await t.query(
      api.plugins.sponsor.portal.sponsorships.listMySponsorships,
      { sessionToken }
    )

    expect(sponsorships).toHaveLength(1)
    expect(sponsorships[0]).toMatchObject({
      competitionId,
      competitionName: "Manual Sponsor Open",
      acquiredVia: "manual_assignment",
    })
    expect(sponsorships[0]?.managementAuctionId).toBeUndefined()
  })
})
