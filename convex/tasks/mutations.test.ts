/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

describe("task mutations", () => {
  test("createTask creates a phase child with defaults and the next order", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const phaseId = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return phaseId
    })

    const taskId = await client.mutation(api.tasks.mutations.createTask, {
      name: "  Book venue deposit  ",
      description: "  Confirm payment terms.  ",
      parent: { type: "phases", id: phaseId },
      assigneeIds: null,
      owner: null,
      dueDate: null,
      labelIds: [],
    })

    const task = await t.run(async (ctx) => await ctx.db.get("tasks", taskId))

    expect(task).toMatchObject({
      name: "Book venue deposit",
      description: "Confirm payment terms.",
      parent: { type: "phases", id: phaseId },
      assigneeIds: null,
      owner: null,
      dueDate: null,
      kind: "standard",
      status: "backlog",
      statusIntent: { type: "manual", status: "backlog" },
    })
    expect(task?.order.localeCompare("a")).toBeGreaterThan(0)
  })

  test("createTask creates a standard task child with properties and labels", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const seed = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const parentTaskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const assigneeId = await ctx.db.insert("users", {
        name: "Assigned User",
      })
      const teamId = await ctx.db.insert("teams", { name: "Software Team" })
      const labelId = await ctx.db.insert("taskLabels", {
        code: "venue",
        name: "Venue",
        color: "sky",
      })

      return { parentTaskId, assigneeId, teamId, labelId }
    })

    const taskId = await client.mutation(api.tasks.mutations.createTask, {
      name: "Build schedule import",
      description: null,
      parent: { type: "tasks", id: seed.parentTaskId },
      initialStatus: "in-progress",
      assigneeIds: [seed.assigneeId, seed.assigneeId],
      owner: { type: "teams", id: seed.teamId },
      dueDate: "2026-06-20",
      labelIds: [seed.labelId, seed.labelId],
    })

    const result = await t.run(async (ctx) => {
      const task = await ctx.db.get("tasks", taskId)
      const assignments = await ctx.db
        .query("taskLabelAssignments")
        .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", taskId))
        .collect()
      return { task, assignments }
    })

    expect(result.task).toMatchObject({
      name: "Build schedule import",
      parent: { type: "tasks", id: seed.parentTaskId },
      assigneeIds: [seed.assigneeId],
      owner: { type: "teams", id: seed.teamId },
      dueDate: "2026-06-20",
      kind: "standard",
      status: "in-progress",
      statusIntent: { type: "manual", status: "in-progress" },
    })
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].labelId).toBe(seed.labelId)
  })

  test("createTask recomputes parent status when adding children", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const parentTaskId = await t.run(async (ctx) => {
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
        status: "done",
      })
    })

    await client.mutation(api.tasks.mutations.createTask, {
      name: "New incomplete child",
      description: null,
      parent: { type: "tasks", id: parentTaskId },
      initialStatus: "backlog",
      assigneeIds: null,
      owner: null,
      dueDate: null,
      labelIds: [],
    })

    const parentTask = await t.run(
      async (ctx) => await ctx.db.get("tasks", parentTaskId)
    )

    expect(parentTask?.status).toBe("in-progress")
    expect(parentTask?.statusIntent).toEqual({ type: "manual", status: "done" })
  })

  test("listCreationTargets searches tasks and includes selected parent", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const seed = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const selectedParentId = await insertSeedTask(ctx, {
        name: "Selected unrelated parent",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const matchingTaskId = await insertSeedTask(ctx, {
        name: "Needle launch task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })

      return { matchingTaskId, selectedParentId }
    })

    const targets = await client.query(api.tasks.queries.listCreationTargets, {
      search: "Needle",
      selectedParent: { type: "tasks", id: seed.selectedParentId },
    })
    const targetIds = new Set(targets.tasks.map((task) => task._id))

    expect(targetIds.has(seed.matchingTaskId)).toBe(true)
    expect(targetIds.has(seed.selectedParentId)).toBe(true)
  })

  test("createTask rejects invalid task input", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const phaseId = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      await ctx.db.delete("phases", phaseId)
      return phaseId
    })

    await expect(
      client.mutation(api.tasks.mutations.createTask, {
        name: "   ",
        description: null,
        parent: { type: "phases", id: phaseId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("Task name is required")

    await expect(
      client.mutation(api.tasks.mutations.createTask, {
        name: "Missing parent",
        description: null,
        parent: { type: "phases", id: phaseId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("Task parent not found")
  })

  test("createTask requires task management permission", async () => {
    const t = convexTest(schema, modules)
    const phaseId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Viewer" })
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      return { userId, phaseId }
    })
    const viewer = t.withIdentity({ subject: phaseId.userId })

    await expect(
      viewer.mutation(api.tasks.mutations.createTask, {
        name: "Unauthorized task",
        description: null,
        parent: { type: "phases", id: phaseId.phaseId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("You do not have permission")
  })

  test("claimTask claims unassigned and assignable tasks only", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)
    const { nullAssigneeTaskId, emptyAssigneeTaskId, assignedTaskId } =
      await t.run(async (ctx) => {
        const competitionId = await insertBlankCompetition(ctx)
        const phaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Setup",
          "a"
        )
        const parent = { type: "phases" as const, id: phaseId }
        const nullAssigneeTaskId = await insertSeedTask(ctx, {
          parent,
          order: "a",
          status: "to-do",
        })
        const emptyAssigneeTaskId = await insertSeedTask(ctx, {
          parent,
          order: "b",
          status: "to-do",
        })
        const assignedTaskId = await insertSeedTask(ctx, {
          parent,
          order: "c",
          status: "to-do",
        })
        const otherUserId = await ctx.db.insert("users", {
          name: "Other User",
        })

        await ctx.db.patch("tasks", emptyAssigneeTaskId, { assigneeIds: [] })
        await ctx.db.patch("tasks", assignedTaskId, {
          assigneeIds: [otherUserId],
        })

        return { nullAssigneeTaskId, emptyAssigneeTaskId, assignedTaskId }
      })

    await client.mutation(api.tasks.mutations.claimTask, {
      id: nullAssigneeTaskId,
    })
    await client.mutation(api.tasks.mutations.claimTask, {
      id: emptyAssigneeTaskId,
    })
    await expect(
      client.mutation(api.tasks.mutations.claimTask, { id: assignedTaskId })
    ).rejects.toThrow("Task is already assigned")

    const tasks = await t.run(async (ctx) => ({
      nullAssigneeTask: await ctx.db.get("tasks", nullAssigneeTaskId),
      emptyAssigneeTask: await ctx.db.get("tasks", emptyAssigneeTaskId),
    }))

    expect(tasks.nullAssigneeTask?.assigneeIds).toEqual([userId])
    expect(tasks.emptyAssigneeTask?.assigneeIds).toEqual([userId])
  })
})
