/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { DEFAULT_TASK_LABELS } from "@/convex/tasks/labels/constants"
import { seedInitialData } from "@/convex/seed/model"
import {
  addUserToTeam,
  insertTestUser,
  seedDirectorUser,
} from "@/convex/testHelpers"
import { getTeamByName } from "@/convex/teams/model"
import { collectAll } from "@/convex/utils"
import { modules } from "@/convex/test.setup"

describe("seedInitialData", () => {
  test("ensures teams and labels on an empty database", async () => {
    const t = convexTest(schema, modules)

    const result = await t.run(async (ctx) => seedInitialData(ctx))

    expect(result).toEqual({
      teamsEnsured: Object.values(TEAM_NAMES).length,
      labelsEnsured: DEFAULT_TASK_LABELS.length,
      directorAssigned: false,
      directorUserId: null,
    })

    await t.run(async (ctx) => {
      const teams = await collectAll(ctx, "teams")
      const labels = await collectAll(ctx, "taskLabels")
      expect(teams.map((team) => team.name).sort()).toEqual(
        Object.values(TEAM_NAMES).sort()
      )
      expect(labels.map((label) => label.code).sort()).toEqual(
        DEFAULT_TASK_LABELS.map((label) => label.code).sort()
      )
    })
  })

  test("makes the sole user a director when there are no team assignments", async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => insertTestUser(ctx, "Founder"))

    const result = await t.run(async (ctx) => seedInitialData(ctx))

    expect(result.directorAssigned).toBe(true)
    expect(result.directorUserId).toBe(userId)

    await t.run(async (ctx) => {
      const directorsTeam = await getTeamByName(ctx, TEAM_NAMES.DIRECTORS)
      expect(directorsTeam).not.toBeNull()
      if (directorsTeam === null) {
        return
      }
      const memberships = await collectAll(ctx, "teamMemberships")
      expect(memberships).toEqual([
        expect.objectContaining({
          teamId: directorsTeam._id,
          userId,
        }),
      ])
    })
  })

  test("does not assign director when team memberships already exist", async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => insertTestUser(ctx, "Founder"))
    await t.run(async (ctx) => {
      await addUserToTeam(ctx, userId, TEAM_NAMES.SOFTWARE)
    })

    const result = await t.run(async (ctx) => seedInitialData(ctx))

    expect(result.directorAssigned).toBe(false)
    expect(result.directorUserId).toBeNull()

    await t.run(async (ctx) => {
      const memberships = await collectAll(ctx, "teamMemberships")
      expect(memberships).toHaveLength(1)
      expect(memberships[0]?.userId).toBe(userId)
    })
  })

  test("does not assign director when multiple users exist", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await insertTestUser(ctx, "User One")
      await insertTestUser(ctx, "User Two")
    })

    const result = await t.run(async (ctx) => seedInitialData(ctx))

    expect(result.directorAssigned).toBe(false)
    await t.run(async (ctx) => {
      expect(await collectAll(ctx, "teamMemberships")).toHaveLength(0)
    })
  })

  test("run mutation is idempotent", async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => insertTestUser(ctx, "Founder"))

    const first = await t.mutation(api.seed.mutations.run, {})
    const second = await t.mutation(api.seed.mutations.run, {})

    expect(first.directorAssigned).toBe(true)
    expect(first.directorUserId).toBe(userId)
    expect(second.directorAssigned).toBe(false)
    expect(second.directorUserId).toBeNull()

    await t.run(async (ctx) => {
      expect(await collectAll(ctx, "teamMemberships")).toHaveLength(1)
    })
  })

  test("does not remove an existing director when re-run", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))

    const result = await t.run(async (ctx) => seedInitialData(ctx))

    expect(result.directorAssigned).toBe(false)
    await t.run(async (ctx) => {
      const directorsTeam = await getTeamByName(ctx, TEAM_NAMES.DIRECTORS)
      expect(directorsTeam).not.toBeNull()
      if (directorsTeam === null) {
        return
      }
      const memberships = await collectAll(ctx, "teamMemberships")
      expect(memberships).toEqual([
        expect.objectContaining({
          teamId: directorsTeam._id,
          userId: directorId,
        }),
      ])
    })
  })
})
