/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertBlankProject,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"

describe("scoped object access", () => {
  test("volunteer can read competition and project updates", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, projectId } = await t.run(async (ctx) => ({
      competitionId: await insertBlankCompetition(ctx),
      projectId: await insertBlankProject(ctx),
    }))
    const { client } = await withVolunteerTestClient(t)

    await expect(
      client.query(api.updates.queries.getCurrent, {
        object: { type: "competitions", id: competitionId },
      })
    ).resolves.toEqual({ update: null, author: null })

    await expect(
      client.query(api.updates.queries.getCurrent, {
        object: { type: "projects", id: projectId },
      })
    ).resolves.toEqual({ update: null, author: null })
  })

  test("unauthenticated users cannot read scoped objects", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) =>
      insertBlankCompetition(ctx)
    )

    await expect(
      t.query(api.updates.queries.getCurrent, {
        object: { type: "competitions", id: competitionId },
      })
    ).rejects.toThrow("Authentication required")
  })

  test("missing objects are not found", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const fakeCompetitionId = await t.run(async (ctx) => {
      const id = await insertBlankCompetition(ctx)
      await ctx.db.delete("competitions", id)
      return id
    })

    await expect(
      client.query(api.updates.queries.getCurrent, {
        object: { type: "competitions", id: fakeCompetitionId },
      })
    ).rejects.toThrow("Competition not found")
  })

  test("non-members cannot update scoped project phases", async () => {
    const t = convexTest(schema, modules)
    const { projectId, phaseId } = await t.run(async (ctx) => {
      const projectId = await insertBlankProject(ctx)
      const phaseId = await ctx.db.insert("phases", {
        name: "Planning",
        owner: { type: "projects", id: projectId },
        sortKey: "a",
        color: "gray",
      })
      return { projectId, phaseId }
    })
    const outsiderId = await t.run(async (ctx) =>
      insertTestUser(ctx, "Outsider")
    )
    const outsider = t.withIdentity({ subject: outsiderId })

    await expect(
      outsider.mutation(api.projects.mutations.setCurrentPhase, {
        id: projectId,
        phaseId,
      })
    ).rejects.toThrow("You do not have permission to perform this action.")
  })
})
