import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertTestUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("competition update mutations", () => {
  test("rejects unauthenticated users from posting updates", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) => insertBlankCompetition(ctx))

    await expect(
      t.mutation(api.competitions.updates.mutations.setForCompetition, {
        competitionId,
        body: "Hello",
      })
    ).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    })
  })

  test("rejects users without competition access", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId } = await t.run(async (ctx) => {
      const actorId = await insertTestUser(ctx, "Outsider")
      const competitionId = await insertBlankCompetition(ctx)
      return { actorId, competitionId }
    })

    await expect(
      t
        .withIdentity({ subject: actorId })
        .mutation(api.competitions.updates.mutations.setForCompetition, {
          competitionId,
          body: "Hello",
        })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("allows organisers to post updates on their competition", async () => {
    const t = convexTest(schema, modules)
    const { organiserId, competitionId } = await t.run(async (ctx) => {
      const organiserId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", competitionId, {
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [organiserId],
        },
      })
      return { organiserId, competitionId }
    })

    const updateId = await t
      .withIdentity({ subject: organiserId })
      .mutation(api.competitions.updates.mutations.setForCompetition, {
        competitionId,
        body: "Organiser update",
      })

    expect(updateId).toBeDefined()
  })

  test("rejects volunteers from editing weekend slots", async () => {
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Volunteer")
      await addUserToTeam(ctx, userId, TEAM_NAMES.VOLUNTEER)
      return userId
    })

    await expect(
      t
        .withIdentity({ subject: volunteerId })
        .mutation(api.competitions.weekendSlots.mutations.setNote, {
          year: 2026,
          weekendStart: "2026-06-06",
          note: "Reserved",
        })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })
})
