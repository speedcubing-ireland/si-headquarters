import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import { ConvexError } from "convex/values"
import { isExpectedSponsorAccessError } from "./competitionSnapshot"
import {
  createSponsorTestHarness,
  seedSponsorAuctionAccess,
  seedSponsorshipManager,
} from "@/convex/plugins/sponsor/testing/sponsorHarness.test"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

async function seedLinkedCompetitionAuction(wcaCompetitionId: string) {
  vi.stubEnv("DEPLOYMENT_CONTEXT", "production")
  const t = createSponsorTestHarness()
  const directorId = await seedSponsorshipManager(t)
  const { auctionId, competitionId } = await seedSponsorAuctionAccess(t, {
    auctionState: "scheduled",
  })
  await t.mutation(internal.plugins.wca.competitionLink.saveCompetitionLink, {
    competitionId,
    wcaCompetitionId,
    name: "Missing WCA Competition",
    url: `https://www.worldcubeassociation.org/competitions/${wcaCompetitionId}`,
  })
  await t.mutation(internal.integrations.tokensStore.saveToken, {
    service: "wca",
    token: {
      accessToken: "service-account-token",
      refreshToken: "service-account-refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 3_600,
    },
  })
  return { t, directorId, auctionId, competitionId }
}

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

describe("refreshCompetitionSnapshot WCA failures", () => {
  test("unlinks a linked competition when WCA returns 404", async () => {
    const wcaCompetitionId = "MissingComp2026"
    const { t, directorId, auctionId, competitionId } =
      await seedLinkedCompetitionAuction(wcaCompetitionId)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: `Competition with id ${wcaCompetitionId} not found`,
          data: { model: "Competition", id: wcaCompetitionId },
        },
        { status: 404 }
      )
    )

    const result = await t
      .withIdentity({ subject: directorId })
      .action(
        api.plugins.sponsor.admin.auctions.competitionSnapshot
          .refreshCompetitionSnapshot,
        { auctionId }
      )

    expect(result).toMatchObject({
      status: "missing_wca_link",
      message: `WCA competition "${wcaCompetitionId}" could not be found. The WCA link has been removed.`,
      summarySource: "competition_record",
    })
    const state = await t.run(async (ctx) => ({
      competition: await ctx.db.get("competitions", competitionId),
      auction: await ctx.db.get("sponsorshipAuctions", auctionId),
      linkedResource: await ctx.db
        .query("objectLinkedResources")
        .withIndex(
          "by_object_type_and_object_id_and_resourceType_and_resourceKey",
          (q) =>
            q
              .eq("object.type", "competitions")
              .eq("object.id", competitionId)
              .eq("resourceType", "wcaCompetition")
              .eq("resourceKey", "default")
        )
        .unique(),
    }))
    expect(state.competition?.wcaCompetitionId).toBeUndefined()
    expect(state.linkedResource).toBeNull()
    expect(state.auction?.competitionSnapshot?.source).toBe(
      "competition_record"
    )
  })

  test("keeps the link when WCA has a transient failure", async () => {
    const wcaCompetitionId = "ExistingComp2026"
    const { t, directorId, auctionId, competitionId } =
      await seedLinkedCompetitionAuction(wcaCompetitionId)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "Service unavailable" }, { status: 503 })
    )

    const result = await t
      .withIdentity({ subject: directorId })
      .action(
        api.plugins.sponsor.admin.auctions.competitionSnapshot
          .refreshCompetitionSnapshot,
        { auctionId }
      )

    expect(result.status).toBe("fetch_failed")
    const competition = await t.run((ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.wcaCompetitionId).toBe(wcaCompetitionId)
  })
})
