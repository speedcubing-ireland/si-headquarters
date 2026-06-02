import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertTestUser,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"

describe("competition linked resources", () => {
  test("stores linked resource rows in the database", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertBlankCompetition(ctx)
    )
    const resourceId = await t.run(async (ctx) =>
      ctx.db.insert("competitionLinkedResources", {
        competitionId,
        resourceType: "googleSheet",
        resourceKey: "default",
        data: {
          resourceType: "googleSheet",
          sheetId: "abc123",
          title: "Schedule",
          url: "https://docs.google.com/spreadsheets/d/abc123",
        },
      })
    )
    const row = await t.run(async (ctx) =>
      ctx.db.get("competitionLinkedResources", resourceId)
    )
    expect(row?.data.resourceType).toBe("googleSheet")
  })

  test("organiser can list linked resources", async () => {
    const t = convexTest(schema, modules)
    const { userId, competitionId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      return { userId, competitionId }
    })

    const listed = await t
      .withIdentity({ subject: userId })
      .query(api.plugins.core.competitionResources.listForCompetition, {
        competitionId,
      })
    expect(listed).toEqual([])
  })

  test("requires authentication to list linked resources", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertBlankCompetition(ctx)
    )

    await expect(
      t.query(api.plugins.core.competitionResources.listForCompetition, {
        competitionId,
      })
    ).rejects.toThrow()
  })

  test("organiser can upsert and remove a google sheet resource", async () => {
    const t = convexTest(schema, modules)
    const { userId, competitionId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [userId],
        },
      })
      return { userId, competitionId }
    })
    const asOrganiser = t.withIdentity({ subject: userId })

    const resourceId = await t.mutation(
      internal.plugins.core.competitionResourcesInternal.upsertResource,
      {
        competitionId,
        resourceType: "googleSheet",
        resourceKey: "default",
        data: {
          resourceType: "googleSheet",
          sheetId: "abc123",
          title: "Schedule",
          url: "https://docs.google.com/spreadsheets/d/abc123",
        },
      }
    )

    const listed = await asOrganiser.query(
      api.plugins.core.competitionResources.listForCompetition,
      { competitionId }
    )
    expect(listed).toHaveLength(1)
    expect(listed[0]?._id).toEqual(resourceId)

    await asOrganiser.mutation(
      api.plugins.core.competitionResources.removeResource,
      { id: resourceId }
    )

    const afterRemove = await asOrganiser.query(
      api.plugins.core.competitionResources.listForCompetition,
      { competitionId }
    )
    expect(afterRemove).toHaveLength(0)
  })

  test("linking WCA resource syncs competitions.wcaCompetitionId", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertBlankCompetition(ctx)
    )

    await t.mutation(
      internal.plugins.core.competitionResourcesInternal.upsertResource,
      {
        competitionId,
        resourceType: "wcaCompetition",
        resourceKey: "default",
        data: {
          resourceType: "wcaCompetition",
          wcaCompetitionId: "DublinOpen2026",
          name: "Dublin Open 2026",
          url: "https://www.worldcubeassociation.org/competitions/DublinOpen2026",
        },
      }
    )
    await t.mutation(
      internal.plugins.wca.competitionLink.patchCompetitionWcaId,
      {
        competitionId,
        wcaCompetitionId: "DublinOpen2026",
      }
    )

    const competition = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.wcaCompetitionId).toBe("DublinOpen2026")
  })

  test("volunteer without organiser access cannot list discord channels", async () => {
    const t = convexTest(schema, modules)
    const { userId, competitionId } = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Volunteer")
      await addUserToTeam(ctx, userId, TEAM_NAMES.VOLUNTEER)
      const competitionId = await insertBlankCompetition(ctx)
      return { userId, competitionId }
    })

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.plugins.discord.channels.listChannels, { competitionId })
    ).rejects.toThrow()
  })
})
