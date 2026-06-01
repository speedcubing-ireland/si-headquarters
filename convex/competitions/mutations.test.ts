/// <reference types="vite/client" />

import { api } from "@/convex/_generated/api"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertTestUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("competition mutations", () => {
  test("setCompLead requires the selected user to be on the Competitions Team", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId, competitionMemberId, delegateMemberId } =
      await t.run(async (ctx) => {
        const actorId = await insertTestUser(ctx, "Manager")
        const competitionMemberId = await insertTestUser(ctx, "Competition Member")
        const delegateMemberId = await insertTestUser(ctx, "Delegate Member")
        await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
        await addUserToTeam(ctx, competitionMemberId, TEAM_NAMES.COMPETITIONS)
        await addUserToTeam(ctx, delegateMemberId, TEAM_NAMES.DELEGATES)
        const competitionId = await insertBlankCompetition(ctx)

        return {
          actorId,
          competitionId,
          competitionMemberId,
          delegateMemberId,
        }
      })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setCompLead, {
      id: competitionId,
      userId: competitionMemberId,
    })
    await expect(
      actor.mutation(api.competitions.mutations.setCompLead, {
        id: competitionId,
        userId: delegateMemberId,
      })
    ).rejects.toThrow("Competition lead must be a member")

    const stored = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(stored?.people.compLead).toBe(competitionMemberId)
  })

  test("setLeadDelegate requires the selected user to be on the Delegates team", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId, competitionMemberId, delegateMemberId } =
      await t.run(async (ctx) => {
        const actorId = await insertTestUser(ctx, "Manager")
        const competitionMemberId = await insertTestUser(ctx, "Competition Member")
        const delegateMemberId = await insertTestUser(ctx, "Delegate Member")
        await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
        await addUserToTeam(ctx, competitionMemberId, TEAM_NAMES.COMPETITIONS)
        await addUserToTeam(ctx, delegateMemberId, TEAM_NAMES.DELEGATES)
        const competitionId = await insertBlankCompetition(ctx)

        return {
          actorId,
          competitionId,
          competitionMemberId,
          delegateMemberId,
        }
      })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setLeadDelegate, {
      id: competitionId,
      userId: delegateMemberId,
    })
    await expect(
      actor.mutation(api.competitions.mutations.setLeadDelegate, {
        id: competitionId,
        userId: competitionMemberId,
      })
    ).rejects.toThrow("Lead delegate must be a member")

    const stored = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(stored?.people.leadDelegate).toBe(delegateMemberId)
  })

  test("competition people role assignments can still be cleared", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId } = await t.run(async (ctx) => {
      const actorId = await insertTestUser(ctx, "Manager")
      const competitionMemberId = await insertTestUser(ctx, "Competition Member")
      const delegateMemberId = await insertTestUser(ctx, "Delegate Member")
      await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
      await addUserToTeam(ctx, competitionMemberId, TEAM_NAMES.COMPETITIONS)
      await addUserToTeam(ctx, delegateMemberId, TEAM_NAMES.DELEGATES)
      const competitionId = await ctx.db.insert("competitions", {
        name: "Spring Open",
        description: null,
        people: {
          compLead: competitionMemberId,
          leadDelegate: delegateMemberId,
          organisers: [],
        },
        compDates: { from: null, to: null },
        phaseId: null,
        updateId: null,
      })

      return { actorId, competitionId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setCompLead, {
      id: competitionId,
      userId: null,
    })
    await actor.mutation(api.competitions.mutations.setLeadDelegate, {
      id: competitionId,
      userId: null,
    })

    const stored = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(stored?.people.compLead).toBeNull()
    expect(stored?.people.leadDelegate).toBeNull()
  })
})
