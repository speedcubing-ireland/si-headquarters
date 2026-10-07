import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { achievementsCompetitionUrl } from "@/convex/plugins/wca/achievements"
import { ACHIEVEMENTS_SITE_URL_ENV } from "@/convex/plugins/wca/definition"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  insertTestUser,
} from "@/convex/testHelpers"

describe("achievementsCompetitionUrl", () => {
  test("joins the site URL and competition id, trimming trailing slashes", () => {
    expect(
      achievementsCompetitionUrl(
        "Irish2026",
        "https://achievements.example.com//"
      )
    ).toBe("https://achievements.example.com/competitions/Irish2026")
  })

  test("encodes the competition id", () => {
    expect(
      achievementsCompetitionUrl("a/b c", "https://achievements.example.com")
    ).toBe("https://achievements.example.com/competitions/a%2Fb%20c")
  })

  test.each([undefined, "", "  "])(
    "returns null when the site URL is %j",
    (siteUrl) => {
      expect(achievementsCompetitionUrl("Irish2026", siteUrl)).toBeNull()
    }
  )
})

describe("getBadgesLinkForTask", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function seedOrganiserTask(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: { compLead: null, leadDelegate: null, organisers: [userId] },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Ops",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        name: "Badges ready",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { userId, competitionId, taskId }
    })
  }

  test("links to the competition's SI Achievements page once WCA is linked", async () => {
    vi.stubEnv(ACHIEVEMENTS_SITE_URL_ENV, "https://achievements.example.com/")
    const t = convexTest(schema, modules)
    const { userId, competitionId, taskId } = await seedOrganiserTask(t)
    const asOrganiser = t.withIdentity({ subject: userId })

    expect(
      await asOrganiser.query(
        api.plugins.wca.achievements.getBadgesLinkForTask,
        { taskId }
      )
    ).toEqual({ wcaCompetitionId: null, url: null })

    await t.run(async (ctx) => {
      await ctx.db.patch("competitions", competitionId, {
        wcaCompetitionId: "MeathForMegaSpeed2026",
      })
    })

    expect(
      await asOrganiser.query(
        api.plugins.wca.achievements.getBadgesLinkForTask,
        { taskId }
      )
    ).toEqual({
      wcaCompetitionId: "MeathForMegaSpeed2026",
      url: "https://achievements.example.com/competitions/MeathForMegaSpeed2026",
    })
  })

  test("has no link when the deployment has no SI Achievements site", async () => {
    vi.stubEnv(ACHIEVEMENTS_SITE_URL_ENV, undefined)
    const t = convexTest(schema, modules)
    const { userId, competitionId, taskId } = await seedOrganiserTask(t)
    await t.run(async (ctx) => {
      await ctx.db.patch("competitions", competitionId, {
        wcaCompetitionId: "MeathForMegaSpeed2026",
      })
    })

    expect(
      await t
        .withIdentity({ subject: userId })
        .query(api.plugins.wca.achievements.getBadgesLinkForTask, { taskId })
    ).toEqual({ wcaCompetitionId: "MeathForMegaSpeed2026", url: null })
  })
})
