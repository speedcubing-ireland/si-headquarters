/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { TaskKind } from "@/convex/tasks/kind"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import type {
  TaskStatus,
  TaskStatusIntent,
} from "@/convex/tasks/status/resolver"
import { withVolunteerTestClient } from "@/convex/testHelpers"

interface TaskSeed {
  name: string
  parent: Doc<"tasks">["parent"]
  order: string
  kind?: TaskKind
  status?: TaskStatus
}

async function insertCompetition(ctx: MutationCtx) {
  return await ctx.db.insert("competitions", {
    name: "Spring Open",
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
    updateId: null,
  })
}

async function insertPhase(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  name: string,
  sortKey: string
) {
  return await ctx.db.insert("phases", {
    name,
    owner: {
      type: "competitions",
      id: competitionId,
    },
    sortKey,
    color: "gray",
  })
}

async function insertTask(ctx: MutationCtx, seed: TaskSeed) {
  const status = seed.status ?? "backlog"
  const statusIntent: TaskStatusIntent = { type: "manual", status }

  return await ctx.db.insert("tasks", {
    name: seed.name,
    description: null,
    parent: seed.parent,
    order: seed.order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: seed.kind ?? "standard",
    status,
    statusIntent,
  })
}

describe("subtask view", () => {
  test("task owner returns a single pseudo-phase with hydrated task rows", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const { parentId, childId, grandchildId, labelId, ownerId, assigneeId } =
      await t.run(async (ctx) => {
        const competitionId = await insertCompetition(ctx)
        const phaseId = await insertPhase(ctx, competitionId, "Setup", "a")
        const parentId = await insertTask(ctx, {
          name: "Build website",
          parent: { type: "phases", id: phaseId },
          order: "a",
          status: "in-progress",
        })
        const childId = await insertTask(ctx, {
          name: "Draft content",
          parent: { type: "tasks", id: parentId },
          order: "a",
          status: "done",
        })
        const grandchildId = await insertTask(ctx, {
          name: "Review copy",
          parent: { type: "tasks", id: childId },
          order: "a",
          status: "done",
        })
        const labelId = await ctx.db.insert("taskLabels", {
          code: "content",
          name: "Content",
          color: "emerald",
        })
        const ownerId = await ctx.db.insert("users", { name: "Owner User" })
        const assigneeId = await ctx.db.insert("users", {
          name: "Assignee User",
        })
        await Promise.all([
          ctx.db.insert("taskLabelAssignments", {
            taskId: childId,
            labelId,
          }),
          ctx.db.patch("tasks", childId, {
            owner: { type: "users", id: ownerId },
            assigneeIds: [assigneeId],
            dueDate: "2026-05-25",
          }),
        ])

        return { parentId, childId, grandchildId, labelId, ownerId, assigneeId }
      })

    const view = await client.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    expect(view.owner).toEqual({ type: "tasks", id: parentId })
    expect(view.sections).toHaveLength(1)
    expect(view.sections[0].title).toBe("Subtasks")
    expect(view.sections[0].progress).toMatchObject({
      total: 1,
      terminalComplete: 1,
      done: 1,
    })
    expect(view.sections[0].rows).toHaveLength(1)
    const [childRow] = view.sections[0].rows
    expect(childRow.task._id).toBe(childId)
    expect(childRow.task.name).toBe("Draft content")
    expect(childRow.task.dueDate).toBe("2026-05-25")
    expect(childRow.labels).toEqual([
      {
        _id: labelId,
        code: "content",
        name: "Content",
        color: "emerald",
      },
    ])
    expect(childRow.owner?.type).toBe("users")
    expect(childRow.owner?._id).toBe(ownerId)
    expect(childRow.path).toEqual({
      taskTitle: "Draft content",
      subtaskTitle: "",
      subtaskIndicator: "1/1",
      taskTitleId: childId,
      subtaskTitleId: null,
      depth: 0,
    })
    expect(childRow.subtaskSummary).toEqual([
      {
        _id: grandchildId,
        name: "Review copy",
        status: "done",
      },
    ])
    expect(childRow.assignees.userIds).toEqual([assigneeId])
  })

  test("competition owner returns ordered real phase sections", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const { competitionId, conceptPhaseId, currentPhaseId, currentTaskId } =
      await t.run(async (ctx) => {
        const competitionId = await insertCompetition(ctx)
        const conceptPhaseId = await insertPhase(
          ctx,
          competitionId,
          "Concept",
          "a"
        )
        const currentPhaseId = await insertPhase(
          ctx,
          competitionId,
          "Pre-Announcement",
          "b"
        )
        await ctx.db.patch("competitions", competitionId, {
          phaseId: currentPhaseId,
        })
        await insertTask(ctx, {
          name: "Book venue",
          parent: { type: "phases", id: conceptPhaseId },
          order: "a",
          status: "done",
        })
        const currentTaskId = await insertTask(ctx, {
          name: "Publish site",
          parent: { type: "phases", id: currentPhaseId },
          order: "a",
          status: "to-do",
        })

        return { competitionId, conceptPhaseId, currentPhaseId, currentTaskId }
      })

    const view = await client.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "competitions", id: competitionId },
    })

    expect(view.owner).toEqual({ type: "competitions", id: competitionId })
    expect(
      view.sections.map((section) => ({
        title: section.title,
        phaseId: section.phaseId,
        isCurrent: section.isCurrent,
        done: section.progress.done,
        total: section.progress.total,
        rowIds: section.rows.map((row) => row.task._id),
      }))
    ).toEqual([
      {
        title: "Concept",
        phaseId: conceptPhaseId,
        isCurrent: false,
        done: 1,
        total: 1,
        rowIds: [view.sections[0].rows[0].task._id],
      },
      {
        title: "Pre-Announcement",
        phaseId: currentPhaseId,
        isCurrent: true,
        done: 0,
        total: 1,
        rowIds: [currentTaskId],
      },
    ])
  })

  test("flow, done, and cancelled tasks do not contribute nested subtask rows", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const parentId = await t.run(async (ctx) => {
      const competitionId = await insertCompetition(ctx)
      const phaseId = await insertPhase(ctx, competitionId, "Operations", "a")
      const parentId = await insertTask(ctx, {
        name: "Parent task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "in-progress",
      })

      const flowTaskId = await insertTask(ctx, {
        name: "Flow child",
        parent: { type: "tasks", id: parentId },
        order: "a",
        kind: "flow",
        status: "in-progress",
      })
      await insertTask(ctx, {
        name: "Hidden flow grandchild",
        parent: { type: "tasks", id: flowTaskId },
        order: "a",
        status: "to-do",
      })

      const doneTaskId = await insertTask(ctx, {
        name: "Done child",
        parent: { type: "tasks", id: parentId },
        order: "b",
        status: "done",
      })
      await insertTask(ctx, {
        name: "Hidden done grandchild",
        parent: { type: "tasks", id: doneTaskId },
        order: "a",
        status: "done",
      })

      const cancelledTaskId = await insertTask(ctx, {
        name: "Cancelled child",
        parent: { type: "tasks", id: parentId },
        order: "c",
        status: "cancelled",
      })
      await insertTask(ctx, {
        name: "Hidden cancelled grandchild",
        parent: { type: "tasks", id: cancelledTaskId },
        order: "a",
        status: "to-do",
      })

      const openTaskId = await insertTask(ctx, {
        name: "Open child",
        parent: { type: "tasks", id: parentId },
        order: "d",
        status: "in-progress",
      })
      await insertTask(ctx, {
        name: "Visible open grandchild",
        parent: { type: "tasks", id: openTaskId },
        order: "a",
        status: "to-do",
      })

      return parentId
    })

    const view = await client.query(api.tasks.queries.getSubtaskView, {
      owner: { type: "tasks", id: parentId },
    })

    expect(view.sections).toHaveLength(1)
    expect(
      view.sections[0].rows.map((row) => ({
        name: row.task.name,
        subtaskTitle: row.path.subtaskTitle,
        depth: row.path.depth,
      }))
    ).toEqual([
      { name: "Flow child", subtaskTitle: "", depth: 0 },
      { name: "Done child", subtaskTitle: "", depth: 0 },
      { name: "Cancelled child", subtaskTitle: "", depth: 0 },
      { name: "Open child", subtaskTitle: "", depth: 0 },
      {
        name: "Visible open grandchild",
        subtaskTitle: "Open child",
        depth: 1,
      },
    ])
  })
})
