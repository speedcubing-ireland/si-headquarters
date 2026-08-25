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
import type { FunctionReturnType } from "convex/server"

function collectCreationPhaseIds(
  targets: FunctionReturnType<typeof api.tasks.queries.listCreationTargets>
) {
  return new Set(
    targets.sections.flatMap((section) =>
      section.phase === null ? [] : [section.phase._id]
    )
  )
}

function collectCreationTaskIds(
  targets: FunctionReturnType<typeof api.tasks.queries.listCreationTargets>
) {
  return new Set(
    targets.sections.flatMap((section) => section.tasks.map((task) => task._id))
  )
}

describe("task mutations", () => {
  test("createTask creates a phase child with defaults and the next order", async () => {
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
      await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      return { competitionId, phaseId }
    })

    const taskId = await client.mutation(api.tasks.mutations.createTask, {
      name: "  Book venue deposit  ",
      description: "  Confirm payment terms.  ",
      parent: { type: "phases", id: seed.phaseId },
      scope: { type: "competitions", id: seed.competitionId },
      assigneeIds: null,
      owner: null,
      dueDate: null,
      labelIds: [],
    })

    const task = await t.run(async (ctx) => await ctx.db.get("tasks", taskId))

    expect(task).toMatchObject({
      name: "Book venue deposit",
      description: "Confirm payment terms.",
      parent: { type: "phases", id: seed.phaseId },
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

      return { competitionId, parentTaskId, assigneeId, teamId, labelId }
    })

    const taskId = await client.mutation(api.tasks.mutations.createTask, {
      name: "Build schedule import",
      description: null,
      parent: { type: "tasks", id: seed.parentTaskId },
      scope: { type: "competitions", id: seed.competitionId },
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
        status: "done",
      })
      return { competitionId, parentTaskId }
    })

    await client.mutation(api.tasks.mutations.createTask, {
      name: "New incomplete child",
      description: null,
      parent: { type: "tasks", id: seed.parentTaskId },
      scope: { type: "competitions", id: seed.competitionId },
      initialStatus: "backlog",
      assigneeIds: null,
      owner: null,
      dueDate: null,
      labelIds: [],
    })

    const parentTask = await t.run(
      async (ctx) => await ctx.db.get("tasks", seed.parentTaskId)
    )

    expect(parentTask?.status).toBe("in-progress")
    expect(parentTask?.statusIntent).toEqual({ type: "manual", status: "done" })
  })

  test("listCreationTargets scopes competition parents to the visible tree", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const seed = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const setupPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const laterPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Later",
        "b"
      )
      const outsideCompetitionId = await insertBlankCompetition(ctx)
      const outsidePhaseId = await insertCompetitionPhase(
        ctx,
        outsideCompetitionId,
        "Outside",
        "a"
      )
      const selectedParentId = await insertSeedTask(ctx, {
        name: "Selected scoped parent",
        parent: { type: "phases", id: setupPhaseId },
        order: "a",
      })
      const matchingTaskId = await insertSeedTask(ctx, {
        name: "Needle launch task",
        parent: { type: "phases", id: setupPhaseId },
        order: "b",
      })
      const visibleChildId = await insertSeedTask(ctx, {
        name: "Visible nested task",
        parent: { type: "tasks", id: matchingTaskId },
        order: "a",
      })
      const flowParentId = await insertSeedTask(ctx, {
        name: "Visible flow parent",
        parent: { type: "phases", id: setupPhaseId },
        order: "c",
        kind: "flow",
      })
      const hiddenFlowChildId = await insertSeedTask(ctx, {
        name: "Hidden flow child",
        parent: { type: "tasks", id: flowParentId },
        order: "a",
      })
      const doneParentId = await insertSeedTask(ctx, {
        name: "Visible done parent",
        parent: { type: "phases", id: laterPhaseId },
        order: "a",
        status: "done",
      })
      const hiddenDoneChildId = await insertSeedTask(ctx, {
        name: "Hidden done child",
        parent: { type: "tasks", id: doneParentId },
        order: "a",
        status: "done",
      })
      const outsideTaskId = await insertSeedTask(ctx, {
        name: "Outside task",
        parent: { type: "phases", id: outsidePhaseId },
        order: "a",
      })

      return {
        competitionId,
        setupPhaseId,
        laterPhaseId,
        outsidePhaseId,
        selectedParentId,
        matchingTaskId,
        visibleChildId,
        flowParentId,
        hiddenFlowChildId,
        doneParentId,
        hiddenDoneChildId,
        outsideTaskId,
      }
    })

    const allTargets = await client.query(
      api.tasks.queries.listCreationTargets,
      {
        scope: { type: "competitions", id: seed.competitionId },
      }
    )
    const phaseIds = collectCreationPhaseIds(allTargets)
    const taskIds = collectCreationTaskIds(allTargets)

    expect(phaseIds.has(seed.setupPhaseId)).toBe(true)
    expect(phaseIds.has(seed.laterPhaseId)).toBe(true)
    expect(phaseIds.has(seed.outsidePhaseId)).toBe(false)
    expect(taskIds.has(seed.selectedParentId)).toBe(true)
    expect(taskIds.has(seed.matchingTaskId)).toBe(true)
    expect(taskIds.has(seed.visibleChildId)).toBe(false)
    expect(taskIds.has(seed.flowParentId)).toBe(true)
    expect(taskIds.has(seed.hiddenFlowChildId)).toBe(false)
    expect(taskIds.has(seed.doneParentId)).toBe(true)
    expect(taskIds.has(seed.hiddenDoneChildId)).toBe(false)
    expect(taskIds.has(seed.outsideTaskId)).toBe(false)

    const scopedSelectedTargets = await client.query(
      api.tasks.queries.listCreationTargets,
      {
        scope: { type: "competitions", id: seed.competitionId },
        search: "Needle",
        selectedParent: { type: "tasks", id: seed.selectedParentId },
      }
    )
    const scopedSelectedTaskIds = collectCreationTaskIds(scopedSelectedTargets)

    expect(scopedSelectedTaskIds.has(seed.matchingTaskId)).toBe(true)
    expect(scopedSelectedTaskIds.has(seed.selectedParentId)).toBe(true)

    const outsideSelectedTargets = await client.query(
      api.tasks.queries.listCreationTargets,
      {
        scope: { type: "competitions", id: seed.competitionId },
        search: "Needle",
        selectedParent: { type: "tasks", id: seed.outsideTaskId },
      }
    )
    const outsideSelectedTaskIds = collectCreationTaskIds(
      outsideSelectedTargets
    )

    expect(outsideSelectedTaskIds.has(seed.matchingTaskId)).toBe(true)
    expect(outsideSelectedTaskIds.has(seed.outsideTaskId)).toBe(false)
  })

  test("listCreationTargets scopes task parents to the viewed task tree", async () => {
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
      const rootTaskId = await insertSeedTask(ctx, {
        name: "Root task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const viewedTaskId = await insertSeedTask(ctx, {
        name: "Viewed task",
        parent: { type: "tasks", id: rootTaskId },
        order: "a",
      })
      const visibleChildId = await insertSeedTask(ctx, {
        name: "Visible child",
        parent: { type: "tasks", id: viewedTaskId },
        order: "a",
      })
      const visibleGrandchildId = await insertSeedTask(ctx, {
        name: "Visible grandchild",
        parent: { type: "tasks", id: visibleChildId },
        order: "a",
      })
      const doneParentId = await insertSeedTask(ctx, {
        name: "Visible done descendant",
        parent: { type: "tasks", id: viewedTaskId },
        order: "b",
        status: "done",
      })
      const hiddenDoneChildId = await insertSeedTask(ctx, {
        name: "Hidden done descendant",
        parent: { type: "tasks", id: doneParentId },
        order: "a",
        status: "done",
      })
      const siblingTaskId = await insertSeedTask(ctx, {
        name: "Sibling task",
        parent: { type: "tasks", id: rootTaskId },
        order: "b",
      })
      const otherTreeTaskId = await insertSeedTask(ctx, {
        name: "Other tree task",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })

      return {
        viewedTaskId,
        rootTaskId,
        phaseId,
        visibleChildId,
        visibleGrandchildId,
        doneParentId,
        hiddenDoneChildId,
        siblingTaskId,
        otherTreeTaskId,
      }
    })

    const targets = await client.query(api.tasks.queries.listCreationTargets, {
      scope: { type: "tasks", id: seed.viewedTaskId },
    })
    const phaseIds = collectCreationPhaseIds(targets)
    const taskIds = collectCreationTaskIds(targets)

    expect(phaseIds.has(seed.phaseId)).toBe(false)
    expect(taskIds.has(seed.viewedTaskId)).toBe(true)
    expect(taskIds.has(seed.visibleChildId)).toBe(true)
    expect(taskIds.has(seed.visibleGrandchildId)).toBe(false)
    expect(taskIds.has(seed.doneParentId)).toBe(true)
    expect(taskIds.has(seed.hiddenDoneChildId)).toBe(false)
    expect(taskIds.has(seed.rootTaskId)).toBe(false)
    expect(taskIds.has(seed.siblingTaskId)).toBe(false)
    expect(taskIds.has(seed.otherTreeTaskId)).toBe(false)
  })

  test("createTask rejects nested subtask parents for the current view", async () => {
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
        name: "Parent task",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const nestedTaskId = await insertSeedTask(ctx, {
        name: "Nested task",
        parent: { type: "tasks", id: parentTaskId },
        order: "a",
      })
      return { competitionId, nestedTaskId }
    })

    await expect(
      client.mutation(api.tasks.mutations.createTask, {
        name: "Invalid nested child",
        description: null,
        parent: { type: "tasks", id: seed.nestedTaskId },
        scope: { type: "competitions", id: seed.competitionId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("Task parent is not available in this view")
  })

  test("createTask rejects invalid task input", async () => {
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
      await ctx.db.delete("phases", phaseId)
      return { competitionId, phaseId }
    })

    await expect(
      client.mutation(api.tasks.mutations.createTask, {
        name: "   ",
        description: null,
        parent: { type: "phases", id: seed.phaseId },
        scope: { type: "competitions", id: seed.competitionId },
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
        parent: { type: "phases", id: seed.phaseId },
        scope: { type: "competitions", id: seed.competitionId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("Task parent is not available in this view")
  })

  test("createTask requires task management permission", async () => {
    const t = convexTest(schema, modules)
    const seed = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Viewer" })
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      return { userId, competitionId, phaseId }
    })
    const viewer = t.withIdentity({ subject: seed.userId })

    await expect(
      viewer.mutation(api.tasks.mutations.createTask, {
        name: "Unauthorized task",
        description: null,
        parent: { type: "phases", id: seed.phaseId },
        scope: { type: "competitions", id: seed.competitionId },
        assigneeIds: null,
        owner: null,
        dueDate: null,
        labelIds: [],
      })
    ).rejects.toThrow("You do not have permission")
  })

  test("reorderTasks rewrites sibling order with fractional keys and recomputes flow state", async () => {
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
      const flowId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "a",
        kind: "flow",
        status: "to-do",
      })
      await ctx.db.patch("tasks", flowId, { statusIntent: { type: "auto" } })
      const firstId = await insertSeedTask(ctx, {
        name: "First",
        parent: { type: "tasks", id: flowId },
        order: "a",
        status: "done",
      })
      const secondId = await insertSeedTask(ctx, {
        name: "Second",
        parent: { type: "tasks", id: flowId },
        order: "b",
        status: "to-do",
      })
      const thirdId = await insertSeedTask(ctx, {
        name: "Third",
        parent: { type: "tasks", id: flowId },
        order: "c",
        status: "backlog",
      })

      return { flowId, firstId, secondId, thirdId }
    })

    await client.mutation(api.tasks.mutations.reorderTasks, {
      parent: { type: "tasks", id: seed.flowId },
      taskIds: [seed.thirdId, seed.firstId, seed.secondId],
    })

    const result = await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
          q.eq("parent.type", "tasks").eq("parent.id", seed.flowId)
        )
        .order("asc")
        .collect()
      return tasks.map((task) => ({
        id: task._id,
        order: task.order,
        status: task.status,
      }))
    })

    expect(result.map((task) => task.id)).toEqual([
      seed.thirdId,
      seed.firstId,
      seed.secondId,
    ])
    expect(result.map((task) => task.order)).toEqual(["a0", "a1", "a2"])
    expect(result.map((task) => task.status)).toEqual([
      "to-do",
      "backlog",
      "backlog",
    ])
  })

  test("reorderTaskSections moves tasks across phase parents", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const seed = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const firstPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Setup",
        "a"
      )
      const secondPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Schedule",
        "b"
      )
      const thirdPhaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Empty",
        "c"
      )
      const firstId = await insertSeedTask(ctx, {
        name: "First",
        parent: { type: "phases", id: firstPhaseId },
        order: "a",
      })
      const secondId = await insertSeedTask(ctx, {
        name: "Second",
        parent: { type: "phases", id: firstPhaseId },
        order: "b",
      })
      const thirdId = await insertSeedTask(ctx, {
        name: "Third",
        parent: { type: "phases", id: secondPhaseId },
        order: "a",
      })

      return {
        firstId,
        firstPhaseId,
        secondId,
        secondPhaseId,
        thirdId,
        thirdPhaseId,
      }
    })

    await client.mutation(api.tasks.mutations.reorderTaskSections, {
      sections: [
        {
          parent: { type: "phases", id: seed.firstPhaseId },
          taskIds: [seed.secondId],
        },
        {
          parent: { type: "phases", id: seed.secondPhaseId },
          taskIds: [seed.thirdId, seed.firstId],
        },
        {
          parent: { type: "phases", id: seed.thirdPhaseId },
          taskIds: [],
        },
      ],
    })

    const result = await t.run(async (ctx) => {
      async function phaseTaskIds(phaseId: typeof seed.firstPhaseId) {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", phaseId)
          )
          .order("asc")
          .collect()
        return tasks.map((task) => ({
          id: task._id,
          order: task.order,
          parent: task.parent,
        }))
      }

      return {
        firstPhase: await phaseTaskIds(seed.firstPhaseId),
        secondPhase: await phaseTaskIds(seed.secondPhaseId),
        thirdPhase: await phaseTaskIds(seed.thirdPhaseId),
      }
    })

    expect(result.firstPhase.map((task) => task.id)).toEqual([seed.secondId])
    expect(result.firstPhase.map((task) => task.order)).toEqual(["a0"])
    expect(result.secondPhase.map((task) => task.id)).toEqual([
      seed.thirdId,
      seed.firstId,
    ])
    expect(result.secondPhase.map((task) => task.order)).toEqual(["a0", "a1"])
    expect(result.secondPhase[1]?.parent).toEqual({
      type: "phases",
      id: seed.secondPhaseId,
    })
    expect(result.thirdPhase).toEqual([])
  })

  test("reorderTaskSections rejects stale task lists", async () => {
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
      await insertSeedTask(ctx, {
        name: "First",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const secondId = await insertSeedTask(ctx, {
        name: "Second",
        parent: { type: "phases", id: phaseId },
        order: "b",
      })

      return { phaseId, secondId }
    })

    await expect(
      client.mutation(api.tasks.mutations.reorderTaskSections, {
        sections: [
          {
            parent: { type: "phases", id: seed.phaseId },
            taskIds: [seed.secondId],
          },
        ],
      })
    ).rejects.toThrow("Task list changed. Refresh and try again.")
  })

  test("reorderTaskSections rejects moves under descendants", async () => {
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
      const parentId = await insertSeedTask(ctx, {
        name: "Parent",
        parent: { type: "phases", id: phaseId },
        order: "a",
      })
      const childId = await insertSeedTask(ctx, {
        name: "Child",
        parent: { type: "tasks", id: parentId },
        order: "a",
      })

      return { childId, parentId, phaseId }
    })

    await expect(
      client.mutation(api.tasks.mutations.reorderTaskSections, {
        sections: [
          {
            parent: { type: "phases", id: seed.phaseId },
            taskIds: [],
          },
          {
            parent: { type: "tasks", id: seed.parentId },
            taskIds: [seed.childId],
          },
          {
            parent: { type: "tasks", id: seed.childId },
            taskIds: [seed.parentId],
          },
        ],
      })
    ).rejects.toThrow("Cannot move a task under itself or its descendants")
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
