/// <reference types="vite/client" />

import { api, components } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import commentsSchema from "../../node_modules/@hamzasaleemorg/convex-comments/src/component/schema"
import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

const commentsModules = import.meta.glob(
  "../../node_modules/@hamzasaleemorg/convex-comments/src/component/**/*.ts"
)

describe("task deletion", () => {
  test("removes a task tree and task-scoped records", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true })
    t.registerComponent("comments", commentsSchema, commentsModules)
    const { client, userId } = await withVolunteerTestClient(t)
    const seed = await t.run(async (ctx) => {
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
        status: "done",
      })
      const taskId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: parentId },
        order: "a",
        status: "done",
        integrationIds: ["canva.certificates"],
      })
      const childId = await insertSeedTask(ctx, {
        parent: { type: "tasks", id: taskId },
        order: "a",
        status: "to-do",
      })
      const outsideTaskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "to-do",
      })
      const labelId = await ctx.db.insert("taskLabels", {
        code: "ops",
        name: "Ops",
        color: "sky",
      })
      await ctx.db.insert("taskLabelAssignments", { taskId, labelId })
      await ctx.db.insert("taskReviewers", {
        taskId,
        reviewer: { type: "users", id: userId },
        approvedAt: null,
        approvedBy: null,
      })
      await ctx.db.insert("taskReviewOverrides", {
        taskId,
        overriddenAt: Date.now(),
        overriddenBy: userId,
      })
      await ctx.db.insert("taskBlockers", {
        blockingTaskId: taskId,
        blockedTaskId: outsideTaskId,
      })
      await ctx.db.insert("taskBlockers", {
        blockingTaskId: outsideTaskId,
        blockedTaskId: childId,
      })
      await ctx.db.insert("taskReminders", {
        taskId,
        userId,
        remindAt: Date.now() + 60_000,
        message: null,
        scheduledFunctionId: null,
        sentAt: null,
        cancelledAt: null,
        failedAt: null,
        lastError: null,
      })
      await ctx.db.insert("taskNudgeCooldowns", {
        taskId,
        assigneeId: userId,
        lastNudgedAt: Date.now(),
      })
      await ctx.db.insert("subscriptions", {
        userId,
        object: { type: "tasks", id: taskId },
      })
      return { parentId, taskId, childId, outsideTaskId }
    })

    await client.mutation(api.comments.mutations.add, {
      target: { type: "tasks", id: seed.taskId },
      body: "Delete this comment with the task.",
    })

    vi.useFakeTimers()
    try {
      await client.mutation(api.tasks.mutations.deleteTask, { id: seed.taskId })
      await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    } finally {
      vi.useRealTimers()
    }

    const result = await t.run(async (ctx) => {
      const [
        labelAssignments,
        reviewers,
        reviewOverrides,
        blockers,
        reminders,
        nudgeCooldowns,
        subscriptions,
        integrations,
        commentZone,
      ] = await Promise.all([
        ctx.db.query("taskLabelAssignments").collect(),
        ctx.db.query("taskReviewers").collect(),
        ctx.db.query("taskReviewOverrides").collect(),
        ctx.db.query("taskBlockers").collect(),
        ctx.db.query("taskReminders").collect(),
        ctx.db.query("taskNudgeCooldowns").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("taskIntegrations").collect(),
        ctx.runQuery(components.comments.lib.getZone, {
          entityId: `tasks:${seed.taskId}`,
        }),
      ])
      return {
        parent: await ctx.db.get("tasks", seed.parentId),
        deletedTask: await ctx.db.get("tasks", seed.taskId),
        deletedChild: await ctx.db.get("tasks", seed.childId),
        outsideTask: await ctx.db.get("tasks", seed.outsideTaskId),
        commentZone,
        counts: {
          labelAssignments: labelAssignments.length,
          reviewers: reviewers.length,
          reviewOverrides: reviewOverrides.length,
          blockers: blockers.length,
          reminders: reminders.length,
          nudgeCooldowns: nudgeCooldowns.length,
          subscriptions: subscriptions.length,
          integrations: integrations.length,
        },
      }
    })

    expect(result).toMatchObject({
      deletedTask: null,
      deletedChild: null,
      commentZone: null,
      counts: {
        labelAssignments: 0,
        reviewers: 0,
        reviewOverrides: 0,
        blockers: 0,
        reminders: 0,
        nudgeCooldowns: 0,
        subscriptions: 0,
        integrations: 0,
      },
    })
    expect(result.outsideTask).not.toBeNull()
    expect(result.parent?.status).toBe("done")
  })

  test("deletes the supported 200-task tree with production limits enabled", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true })
    const { client } = await withVolunteerTestClient(t)
    const rootTaskId = await t.run(async (ctx) => {
      const competitionId = await insertBlankCompetition(ctx)
      const phaseId = await insertCompetitionPhase(
        ctx,
        competitionId,
        "Scale",
        "a"
      )
      const rootTaskId = await insertSeedTask(ctx, {
        parent: { type: "phases", id: phaseId },
        order: "root",
      })
      for (let index = 0; index < 199; index += 1) {
        await insertSeedTask(ctx, {
          parent: { type: "tasks", id: rootTaskId },
          order: String(index).padStart(3, "0"),
        })
      }
      return rootTaskId
    })

    await client.mutation(api.tasks.mutations.deleteTask, { id: rootTaskId })

    const tasks = await t.run(async (ctx) => ctx.db.query("tasks").collect())
    expect(tasks).toEqual([])
  })
})
