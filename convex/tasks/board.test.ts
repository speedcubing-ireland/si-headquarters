/// <reference types="vite/client" />

import { createTaskBoardReader } from "@/convex/tasks/boardReader"
import { collectAll } from "@/convex/utils"
import { TASK_STATUSES } from "@/convex/tasks/status/validators"

import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"
import { insertSeedTask, withVolunteerTestClient } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

async function insertCompetition(ctx: MutationCtx) {
  return await ctx.db.insert("competitions", {
    name: "Board Open",
    description: null,
    people: {
      compLead: null,
      leadDelegate: null,
      organisers: [],
    },
    compDates: {
      from: null,
      to: null,
    },
    phaseId: null,
  })
}

async function insertPhase(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
) {
  return await ctx.db.insert("phases", {
    name: "Main",
    owner: {
      type: "competitions",
      id: competitionId,
    },
    sortKey: "a",
    color: "gray",
  })
}

describe("task board", () => {
  test("listForBoard includes subtask summary on parents with direct children", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const { parentId, childAId, childBId } = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId)
      const parentId = await ctx.db.insert("tasks", {
        name: "Parent",
        description: null,
        parent: { type: "phases", id: phaseId },
        ...taskRootPatch(
          await deriveTaskRootContextFromParent(ctx, {
            type: "phases",
            id: phaseId,
          })
        ),
        order: "a",
        assigneeIds: null,
        owner: null,
        dueDate: null,
        kind: "standard",
        status: "in-progress",
        statusIntent: { type: "manual", status: "in-progress" },
      })
      const childAId = await ctx.db.insert("tasks", {
        name: "Child A",
        description: null,
        parent: { type: "tasks", id: parentId },
        ...taskRootPatch(
          await deriveTaskRootContextFromParent(ctx, {
            type: "tasks",
            id: parentId,
          })
        ),
        order: "a",
        assigneeIds: null,
        owner: null,
        dueDate: null,
        kind: "standard",
        status: "done",
        statusIntent: { type: "manual", status: "done" },
      })
      const childBId = await ctx.db.insert("tasks", {
        name: "Child B",
        description: null,
        parent: { type: "tasks", id: parentId },
        ...taskRootPatch(
          await deriveTaskRootContextFromParent(ctx, {
            type: "tasks",
            id: parentId,
          })
        ),
        order: "b",
        assigneeIds: null,
        owner: null,
        dueDate: null,
        kind: "standard",
        status: "to-do",
        statusIntent: { type: "manual", status: "to-do" },
      })

      return { parentId, childAId, childBId }
    })

    const rows = await client.query(api.tasks.board.listForBoard, {})

    const parentRow = rows.find((row) => row.task._id === parentId)
    expect(parentRow?.subtaskSummary).toEqual([
      { _id: childAId, name: "Child A", status: "done" },
      { _id: childBId, name: "Child B", status: "to-do" },
    ])
    expect(parentRow?.statusView.progress.total).toBe(2)

    const childRow = rows.find((row) => row.task._id === childAId)
    expect(childRow?.subtaskSummary).toEqual([])
  })
})

describe("board loading cost and scoped results", () => {
  test("team results preserve flow positions and parent context from other owners", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const { teamId, parentId, currentId, futureId } = await t.run(
      async (ctx) => {
        const teamId = await ctx.db.insert("teams", { name: "Operations" })
        const competitionId = await insertCompetition(ctx)
        const phaseId = await insertPhase(ctx, competitionId)
        const parentId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: "a",
          kind: "flow",
          status: "to-do",
        })
        await insertSeedTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "done",
        })
        const currentId = await insertSeedTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "b",
          status: "to-do",
        })
        const futureId = await insertSeedTask(ctx, {
          parent: { type: "tasks", id: parentId },
          order: "c",
          status: "to-do",
        })
        for (const taskId of [currentId, futureId]) {
          await ctx.db.patch("tasks", taskId, {
            owner: { type: "teams", id: teamId },
          })
        }
        return { teamId, parentId, currentId, futureId }
      }
    )
    const all = await client.query(api.tasks.board.listForBoard, {})
    const scoped = await client.query(api.tasks.board.listForBoard, { teamId })
    expect(scoped).toEqual(
      all.filter(
        (row) => row.owner?.type === "teams" && row.owner._id === teamId
      )
    )
    expect(scoped.map((row) => row.task._id)).toEqual([currentId, futureId])
    expect(scoped[0].path.subtaskTitleId).toBe(parentId)
    expect(scoped[0].statusView.isManuallyEditable).toBe(true)
    expect(scoped[1].statusView.effectiveStatus).toBe("backlog")
    // Stored to-do on a future flow step must not pass the effective status filter.
    expect(
      await client.query(api.tasks.board.listForBoard, {
        teamId,
        effectiveStatuses: ["to-do"],
      })
    ).toEqual([scoped[0]])
  })

  test("scoped filtering retains participant access without exposing private siblings", async () => {
    const t = convexTest(schema, modules)
    const { userId, teamId, taskIds } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Organiser" })
      const teamId = await ctx.db.insert("teams", { name: "Operations" })
      const visibleCompetitionId = await insertCompetition(ctx)
      await ctx.db.patch("competitions", visibleCompetitionId, {
        people: { compLead: null, leadDelegate: null, organisers: [userId] },
      })
      const privateCompetitionId = await insertCompetition(ctx)
      const taskIds = []
      for (const competitionId of [
        visibleCompetitionId,
        privateCompetitionId,
      ]) {
        const phaseId = await insertPhase(ctx, competitionId)
        const taskId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: "a",
        })
        await ctx.db.patch("tasks", taskId, {
          owner: { type: "teams", id: teamId },
          assigneeIds: [userId],
        })
        taskIds.push(taskId)
      }
      const privatePhaseId = await insertPhase(ctx, privateCompetitionId)
      const unrelatedId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: privatePhaseId },
        order: "a",
      })
      await ctx.db.patch("tasks", unrelatedId, {
        owner: { type: "teams", id: teamId },
      })
      return { userId, teamId, taskIds }
    })
    const rows = await t
      .withIdentity({ subject: userId })
      .query(api.tasks.board.listForBoard, { teamId })
    expect(rows.map((row) => row.task._id)).toEqual(taskIds)
    expect(
      await t
        .withIdentity({ subject: userId })
        .query(api.tasks.board.listForBoard, { assignedToMe: true })
    ).toEqual(rows)
  })

  test("summary pass does no label reads; display hydration reads only the selected task", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const taskIds = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId)
      const labelId = await ctx.db.insert("taskLabels", {
        code: "OPS",
        name: "Operations",
        color: "slate",
      })
      const taskIds = []
      for (let index = 0; index < 40; index += 1) {
        const taskId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: String(index).padStart(3, "0"),
          status: index > 0 && index % 2 === 0 ? "done" : "to-do",
        })
        await ctx.db.insert("taskLabelAssignments", { taskId, labelId })
        taskIds.push(taskId)
      }
      return taskIds
    })
    const baseline = await client.query(api.tasks.board.listForBoard, {})
    await t.run(async (ctx) => {
      const querySpy = vi.spyOn(ctx.db, "query")
      const getSpy = vi.spyOn(ctx.db, "get")
      try {
        const [
          tasks,
          phases,
          competitions,
          projects,
          taskReviewers,
          taskReviewOverrides,
          taskBlockers,
        ] = await Promise.all([
          collectAll(ctx, "tasks"),
          collectAll(ctx, "phases"),
          collectAll(ctx, "competitions"),
          collectAll(ctx, "projects"),
          collectAll(ctx, "taskReviewers"),
          collectAll(ctx, "taskReviewOverrides"),
          collectAll(ctx, "taskBlockers"),
        ])
        const reader = await createTaskBoardReader(ctx, {
          selectedTaskIds: new Set(taskIds),
          tasks,
          phases,
          competitions,
          projects,
          taskReviewers,
          taskReviewOverrides,
          taskBlockers,
        })
        const summaries = await reader.getSummaries()
        expect(
          summaries.every(
            (row) => !("labels" in row) && !("subtaskSummary" in row)
          )
        ).toBe(true)
        expect(
          querySpy.mock.calls.filter(
            ([table]) =>
              table === "taskLabels" || table === "taskLabelAssignments"
          )
        ).toHaveLength(0)
        expect(
          getSpy.mock.calls.filter(([table]) => table === "taskLabels")
        ).toHaveLength(0)
        const open = await reader.getSummaries({
          effectiveStatuses: TASK_STATUSES.filter(
            (status) => status !== "done" && status !== "cancelled"
          ),
        })
        expect(open.map((row) => row.task._id)).toEqual(
          baseline
            .filter(
              (row) =>
                row.statusView.effectiveStatus !== "done" &&
                row.statusView.effectiveStatus !== "cancelled"
            )
            .map((row) => row.task._id)
        )
        const selected = summaries.filter((row) => row.task._id === taskIds[0])
        expect(await reader.hydrateRows(selected)).toEqual(
          baseline.filter((row) => row.task._id === taskIds[0])
        )
        expect(
          querySpy.mock.calls.filter(
            ([table]) => table === "taskLabelAssignments"
          )
        ).toHaveLength(1)
        expect(
          getSpy.mock.calls.filter(([table]) => table === "taskLabels")
        ).toHaveLength(1)
      } finally {
        querySpy.mockRestore()
        getSpy.mockRestore()
      }
    })
  })
})
