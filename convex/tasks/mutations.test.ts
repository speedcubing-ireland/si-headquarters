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
