import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { detectSponsorLabels } from "@/convex/plugins/socialMedia/lib/sponsorDetection"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("socialMedia sponsorDetection", () => {
  test("detects Kewbz and UTwistCubes in competition text", () => {
    expect(
      detectSponsorLabels("Thanks to Kewbz and U-Twist Cubes for sponsoring!")
    ).toEqual(["Kewbz", "UTwistCubes"])
  })

  test("returns empty when no sponsor patterns match", () => {
    expect(detectSponsorLabels("A regular competition announcement.")).toEqual(
      []
    )
  })
})

describe("socialMedia resolveHqLinks", () => {
  test("returns main-app links for linked WCA ids only", async () => {
    const t = convexTest(schema, modules)
    const { linkedWcaId, competitionId, competitionName } = await t.run(
      async (ctx) => {
        const linkedWcaId = "IrishOpen2026"
        const competitionId = await ctx.db.insert("competitions", {
          name: "Irish Open 2026",
          description: null,
          people: {
            compLead: null,
            leadDelegate: null,
            organisers: [],
          },
          compDates: { from: "2026-06-01", to: "2026-06-02" },
          phaseId: null,
          wcaCompetitionId: linkedWcaId,
        })
        return {
          linkedWcaId,
          competitionId,
          competitionName: "Irish Open 2026",
        }
      }
    )

    const links = await t.query(
      internal.plugins.socialMedia.resolveHqLinks.resolve,
      {
        wcaCompetitionIds: [linkedWcaId, "UnlinkedComp2026"],
      }
    )

    expect(links).toEqual([
      {
        wcaCompetitionId: linkedWcaId,
        competitionId,
        name: competitionName,
      },
    ])
  })
})

function permissionKey(permission: { action: string; subject: string }) {
  return `${permission.action}:${permission.subject}`
}

describe("socialMedia dashboard permissions", () => {
  test("current permissions include SocialMediaDashboard for volunteers", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const directorId = await insertTestUser(ctx, "Director")
      const volunteerId = await insertTestUser(ctx, "Volunteer")
      const financeId = await insertTestUser(ctx, "Finance")

      await addUserToTeam(ctx, directorId, TEAM_NAMES.DIRECTORS)
      await addUserToTeam(ctx, volunteerId, TEAM_NAMES.VOLUNTEER)
      await addUserToTeam(ctx, financeId, TEAM_NAMES.FINANCE)

      return { directorId, volunteerId, financeId }
    })

    const [director, volunteer, finance] = await Promise.all([
      t
        .withIdentity({ subject: ids.directorId })
        .query(api.permissions.queries.currentPermissions, {}),
      t
        .withIdentity({ subject: ids.volunteerId })
        .query(api.permissions.queries.currentPermissions, {}),
      t
        .withIdentity({ subject: ids.financeId })
        .query(api.permissions.queries.currentPermissions, {}),
    ])

    const hasSocialMediaDashboard = (
      permissions: { action: string; subject: string }[]
    ) =>
      permissions.some(
        (permission) =>
          permission.action === "access" &&
          permission.subject === "SocialMediaDashboard"
      )

    expect(director.permissions.map(permissionKey)).toEqual(
      expect.arrayContaining(["manage:all"])
    )
    expect(hasSocialMediaDashboard(volunteer.permissions)).toBe(true)
    expect(hasSocialMediaDashboard(finance.permissions)).toBe(false)
  })

  test("forbidden for users without SocialMediaDashboard access", async () => {
    const t = convexTest(schema, modules)
    const financeId = await t.run(async (ctx) => {
      const id = await insertTestUser(ctx, "Finance")
      await addUserToTeam(ctx, id, TEAM_NAMES.FINANCE)
      return id
    })

    await expect(
      t
        .withIdentity({ subject: financeId })
        .action(api.plugins.socialMedia.dashboard.fetchCompetitions, {})
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })
})
