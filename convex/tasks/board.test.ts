/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import { withVolunteerTestClient } from "@/convex/testHelpers"
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
    updateId: null,
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
