/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"

describe("task access", () => {
  test("requires authentication for task details", async () => {
    const t = convexTest(schema, modules)
    const taskId = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      return await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
    })

    await expect(
      t.query(api.tasks.queries.getDetails, { id: taskId })
    ).rejects.toThrow("Authentication required")
  })

  test("competition organisers can read competition task trees", async () => {
    const t = convexTest(schema, modules)
    const { organiserId, taskId } = await t.run(async (ctx) => {
      const organiserId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      const competition = await ctx.db.get("competitions", competitionId)
      if (competition === null) throw new Error("Competition missing")
      await ctx.db.patch("competitions", competitionId, {
        people: {
          ...competition.people,
          organisers: [organiserId],
        },
      })
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { organiserId, taskId }
    })

    const organiser = t.withIdentity({ subject: organiserId })
    const details = await organiser.query(api.tasks.queries.getDetails, {
      id: taskId,
    })

    expect(details.task._id).toBe(taskId)
  })

  test("assignees can read their task without competition read access", async () => {
    const t = convexTest(schema, modules)
    const { assigneeId, taskId } = await t.run(async (ctx) => {
      const assigneeId = await insertTestUser(ctx, "Assignee")
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      await ctx.db.patch("tasks", taskId, { assigneeIds: [assigneeId] })
      return { assigneeId, taskId }
    })

    const assignee = t.withIdentity({ subject: assigneeId })
    const status = await assignee.query(api.tasks.queries.getStatusView, {
      id: taskId,
    })

    expect(status.effectiveStatus).toBe("backlog")
  })

  test("unrelated users cannot read tasks", async () => {
    const t = convexTest(schema, modules)
    const { outsiderId, taskId } = await t.run(async (ctx) => {
      const outsiderId = await insertTestUser(ctx, "Outsider")
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const taskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { outsiderId, taskId }
    })

    const outsider = t.withIdentity({ subject: outsiderId })
    await expect(
      outsider.query(api.tasks.queries.getDetails, { id: taskId })
    ).rejects.toThrow("You do not have access to this task")
  })

  test("created subtasks store root phase and competition context", async () => {
    const t = convexTest(schema, modules)
    const { client: volunteer } = await withVolunteerTestClient(t)
    const { competitionId, phaseId, parentId } = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const parentId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { competitionId, phaseId, parentId }
    })

    const childId = await volunteer.mutation(api.tasks.mutations.createTask, {
      name: "Child",
      description: null,
      parent: { type: "tasks", id: parentId },
      scope: { type: "competitions", id: competitionId },
      assigneeIds: null,
      owner: null,
      dueDate: null,
      labelIds: [],
    })

    const child = await t.run(async (ctx) => ctx.db.get("tasks", childId))
    expect(child?.rootPhase.id).toBe(phaseId)
    expect(child?.root).toEqual({ type: "competitions", id: competitionId })
  })
})
