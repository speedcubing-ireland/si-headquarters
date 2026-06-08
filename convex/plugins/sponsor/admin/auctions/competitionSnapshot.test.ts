import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import { ConvexError } from "convex/values"
import { isExpectedSponsorAccessError } from "./competitionSnapshot"
import {
  createSponsorTestHarness,
  seedSponsorAuctionAccess,
  seedSponsorshipManager,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

describe("refreshCompetitionSnapshot authorization", () => {
  test("only treats authz ConvexErrors as expected sponsor access failures", () => {
    expect(
      isExpectedSponsorAccessError(
        new ConvexError({
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        })
      )
    ).toBe(true)
    expect(
      isExpectedSponsorAccessError(
        new ConvexError({
          code: "FORBIDDEN",
          message: "Forbidden",
        })
      )
    ).toBe(true)
    expect(
      isExpectedSponsorAccessError(
        new ConvexError({
          code: "BAD_REQUEST",
          message: "Unexpected validation failure",
        })
      )
    ).toBe(false)
  })

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
        }
      )
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  }, 10_000)

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
      }
    )

    expect(result.status).toBe("missing_wca_link")
  })

  test("allows directors to refresh without a sponsor session token", async () => {
    const t = createSponsorTestHarness()
    const directorId = await seedSponsorshipManager(t)
    const { auctionId } = await seedSponsorAuctionAccess(t, {
      auctionState: "scheduled",
    })

    const result = await t
      .withIdentity({ subject: directorId })
      .action(
        api.plugins.sponsor.admin.auctions.competitionSnapshot
          .refreshCompetitionSnapshot,
        { auctionId }
      )

    expect(result.status).toBe("missing_wca_link")
  })
})
