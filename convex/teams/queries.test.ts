/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import {
  addUserToTeam,
  seedDirectorUser,
  seedVolunteerTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { getTeamByName } from "@/convex/teams/model"
import { modules } from "@/convex/test.setup"

describe("teams task UI queries", () => {
  test("listForNavigation returns member work teams, not Volunteer", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)
    await t.run(async (ctx) => {
      await addUserToTeam(ctx, userId, TEAM_NAMES.SOFTWARE)
    })

    const teams = await client.query(api.teams.queries.listForNavigation, {})
    const names = teams.map((team) => team.name)
    expect(names).not.toContain(TEAM_NAMES.VOLUNTEER)
    expect(names).toContain(TEAM_NAMES.SOFTWARE)
    expect(names).not.toContain(TEAM_NAMES.DIRECTORS)
  })

  test("listForTaskFilters excludes Volunteer", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)
    await t.run(async (ctx) => {
      await addUserToTeam(ctx, userId, TEAM_NAMES.SOFTWARE)
    })

    const teams = await client.query(api.teams.queries.listForTaskFilters, {})
    const names = teams.map((team) => team.name)
    expect(names).not.toContain(TEAM_NAMES.VOLUNTEER)
    expect(names).toContain(TEAM_NAMES.SOFTWARE)
    for (const team of teams) {
      expect(Object.keys(team)).toEqual(["_id", "name"])
    }
  })

  test("getForTaskPage allows members and directors, denies outsiders and Volunteer", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)
    const { softwareTeamId, volunteerTeamId } = await t.run(async (ctx) => {
      await addUserToTeam(ctx, userId, TEAM_NAMES.SOFTWARE)
      const software = await getTeamByName(ctx, TEAM_NAMES.SOFTWARE)
      const volunteer = await getTeamByName(ctx, TEAM_NAMES.VOLUNTEER)
      if (software === null || volunteer === null) {
        throw new Error("missing team")
      }
      return { softwareTeamId: software._id, volunteerTeamId: volunteer._id }
    })

    const memberTeam = await client.query(api.teams.queries.getForTaskPage, {
      teamId: softwareTeamId,
    })
    expect(memberTeam?.name).toBe(TEAM_NAMES.SOFTWARE)

    const volunteerPage = await client.query(api.teams.queries.getForTaskPage, {
      teamId: volunteerTeamId,
    })
    expect(volunteerPage).toBeNull()

    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))
    const directorTeam = await t
      .withIdentity({ subject: directorId })
      .query(api.teams.queries.getForTaskPage, { teamId: softwareTeamId })
    expect(directorTeam?.name).toBe(TEAM_NAMES.SOFTWARE)

    const outsiderId = await t.run(async (ctx) =>
      seedVolunteerTestUser(ctx, "Other")
    )
    const denied = await t
      .withIdentity({ subject: outsiderId })
      .query(api.teams.queries.getForTaskPage, { teamId: softwareTeamId })
    expect(denied).toBeNull()
  })
})
