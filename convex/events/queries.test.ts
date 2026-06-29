import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("event report sources", () => {
  test("lists linked competition sheets with their WCA metadata", async () => {
    const t = convexTest(schema, modules)
    const seeded = await t.run(async (ctx) => {
      const volunteerId = await insertTestUser(ctx, "Volunteer")
      await addUserToTeam(ctx, volunteerId, TEAM_NAMES.VOLUNTEER)
      const competitionId = await ctx.db.insert("competitions", {
        name: "Irish Open",
        description: null,
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [],
        },
        compDates: { from: "2026-09-12", to: "2026-09-13" },
        phaseId: null,
        wcaCompetitionId: "IrishOpen2026",
      })
      await ctx.db.insert("competitions", {
        name: "No linked sheet",
        description: null,
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [],
        },
        compDates: { from: "2026-10-01", to: "2026-10-01" },
        phaseId: null,
      })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "googleSheet",
        resourceKey: "default",
        data: {
          resourceType: "googleSheet",
          sheetId: "sheet-id",
          title: "Irish Open schedule",
          url: "https://docs.google.com/spreadsheets/d/sheet-id",
        },
      })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "googleSheet",
        resourceKey: "secondary",
        data: {
          resourceType: "googleSheet",
          sheetId: "secondary-sheet-id",
          title: "Secondary sheet",
          url: "https://docs.google.com/spreadsheets/d/secondary-sheet-id",
        },
      })
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "wcaCompetition",
        resourceKey: "default",
        data: {
          resourceType: "wcaCompetition",
          wcaCompetitionId: "StaleLinkedResource2026",
          name: "Stale linked resource",
          url: "https://www.worldcubeassociation.org/competitions/StaleLinkedResource2026",
        },
      })
      return { volunteerId, competitionId }
    })

    const result = await t
      .withIdentity({ subject: seeded.volunteerId })
      .query(internal.events.queries.listReportSources, {})

    expect(result).toEqual([
      {
        competitionId: seeded.competitionId,
        competitionName: "Irish Open",
        dates: { from: "2026-09-12", to: "2026-09-13" },
        sheet: {
          sheetId: "sheet-id",
          title: "Irish Open schedule",
          url: "https://docs.google.com/spreadsheets/d/sheet-id",
        },
        wcaCompetition: {
          id: "IrishOpen2026",
          url: null,
        },
      },
    ])
  })

  test("rejects users without events dashboard access", async () => {
    const t = convexTest(schema, modules)
    const financeId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Finance")
      await addUserToTeam(ctx, userId, TEAM_NAMES.FINANCE)
      return userId
    })

    await expect(
      t
        .withIdentity({ subject: financeId })
        .query(internal.events.queries.listReportSources, {})
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })
})
