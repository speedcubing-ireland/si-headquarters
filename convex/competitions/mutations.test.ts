/// <reference types="vite/client" />

import { api } from "@/convex/_generated/api"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import {
  addUserToTeam,
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
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
        const competitionMemberId = await insertTestUser(
          ctx,
          "Competition Member"
        )
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
        const competitionMemberId = await insertTestUser(
          ctx,
          "Competition Member"
        )
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
      const competitionMemberId = await insertTestUser(
        ctx,
        "Competition Member"
      )
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

  test("setCompPhase activates backlog phase tasks and recursive standard subtasks", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId, phaseId, taskId, childId } = await t.run(
      async (ctx) => {
        const actorId = await insertTestUser(ctx, "Manager")
        await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
        const competitionId = await insertBlankCompetition(ctx)
        const phaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Launch",
          "a"
        )
        const taskId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: "a",
          status: "backlog",
        })
        const childId = await insertSeedTask(ctx, {
          parent: { type: "tasks", id: taskId },
          order: "a",
          status: "backlog",
        })
        return { actorId, competitionId, phaseId, taskId, childId }
      }
    )
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setCompPhase, {
      id: competitionId,
      phaseId,
    })

    const stored = await t.run(async (ctx) => {
      const competition = await ctx.db.get("competitions", competitionId)
      const task = await ctx.db.get("tasks", taskId)
      const child = await ctx.db.get("tasks", childId)
      if (!competition || !task || !child) throw new Error("Missing row")
      return {
        phaseId: competition.phaseId,
        task: task.status,
        child: child.status,
      }
    })

    expect(stored).toEqual({
      phaseId,
      task: "to-do",
      child: "to-do",
    })
  })

  test("setCompPhase activates nested flow subtasks under a standard phase task", async () => {
    const t = convexTest(schema, modules)
    const {
      actorId,
      competitionId,
      phaseId,
      flowSubtaskId,
      firstStepId,
      secondStepId,
    } = await t.run(async (ctx) => {
      const actorId = await insertTestUser(ctx, "Manager")
      await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Launch",
        "a"
      )
      const parentTaskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "backlog",
      })
      const flowSubtaskId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: parentTaskId },
        order: "a",
        kind: "flow",
        status: "backlog",
      })
      const firstStepId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: flowSubtaskId },
        order: "a",
        status: "backlog",
      })
      const secondStepId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: flowSubtaskId },
        order: "b",
        status: "backlog",
      })
      return {
        actorId,
        competitionId,
        phaseId,
        flowSubtaskId,
        firstStepId,
        secondStepId,
      }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setCompPhase, {
      id: competitionId,
      phaseId,
    })

    const flow = await actor.query(api.tasks.queries.listSubtasks, {
      id: flowSubtaskId,
    })

    expect(flow.parentStatusView.flow?.currentStepId).toBe(firstStepId)
    expect(
      flow.subtasks.map(({ task, statusView }) => ({
        id: task._id,
        status: statusView.effectiveStatus,
      }))
    ).toEqual([
      { id: firstStepId, status: "to-do" },
      { id: secondStepId, status: "backlog" },
    ])
  })

  test("setCompPhase activates the current step of backlog flows in the phase", async () => {
    const t = convexTest(schema, modules)
    const { actorId, competitionId, phaseId, flowId } = await t.run(
      async (ctx) => {
        const actorId = await insertTestUser(ctx, "Manager")
        await addUserToTeam(ctx, actorId, TEAM_NAMES.COMPETITIONS)
        const competitionId = await insertBlankCompetition(ctx)
        const phaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Launch",
          "a"
        )
        const flowId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: "a",
          kind: "flow",
          status: "backlog",
        })
        await insertSeedTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "a",
          status: "backlog",
        })
        await insertSeedTask(ctx, {
          parent: { type: "tasks", id: flowId },
          order: "b",
          status: "backlog",
        })
        return { actorId, competitionId, phaseId, flowId }
      }
    )
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.competitions.mutations.setCompPhase, {
      id: competitionId,
      phaseId,
    })

    const flow = await actor.query(api.tasks.queries.listSubtasks, {
      id: flowId,
    })

    expect(flow.parentStatusView.effectiveStatus).toBe("to-do")
    expect(
      flow.subtasks.map(({ statusView }) => statusView.effectiveStatus)
    ).toEqual(["to-do", "backlog"])
  })
})
