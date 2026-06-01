import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import {
  createSponsorTestHarness,
  seedSponsorAuctionAccess,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

describe("refreshCompetitionSnapshot authorization", () => {
  test("rejects invited sponsors when the auction is hidden", async () => {
    const t = createSponsorTestHarness()
    const { auctionId, sessionToken } = await seedSponsorAuctionAccess(t, {
      auctionState: "draft",
    })

    await expect(
      t.action(
        api.plugins.sponsor.admin.auctions.competitionSnapshot
          .refreshCompetitionSnapshot,
        {
          auctionId,
          sessionToken,
        },
      ),
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("allows invited sponsors to refresh visible auctions", async () => {
    const t = createSponsorTestHarness()
    const { auctionId, sessionToken } = await seedSponsorAuctionAccess(t, {
      auctionState: "scheduled",
    })

    const result = await t.action(
      api.plugins.sponsor.admin.auctions.competitionSnapshot
        .refreshCompetitionSnapshot,
      {
        auctionId,
        sessionToken,
      },
    )

    expect(result.status).toBe("missing_wca_link")
  })
})
