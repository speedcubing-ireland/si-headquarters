/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertBlankProject,
  insertCompetitionPhase,
  insertProjectPhase,
  insertSeedTask,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"

const PARTICIPANT_ROLES = [
  "assignee",
  "user-owner",
  "team-owner",
  "user-reviewer",
  "team-reviewer",
] as const

describe("board participant access", () => {
  for (const rootType of ["competitions", "projects"] as const) {
    test.each(PARTICIPANT_ROLES)(
      `${rootType}: %s sees the same task on its page, board and Home`,
      async (role) => {
        const t = convexTest(schema, modules)
        const { userId, taskId, unrelatedId, teamId } = await t.run(
          async (ctx) => {
            const userId = await insertTestUser(ctx, "Participant")
            const teamId = await ctx.db.insert("teams", {
              name: "Custom operations team",
            })
            await ctx.db.insert("teamMemberships", { userId, teamId })
            const phaseId =
              rootType === "competitions"
                ? await insertCompetitionPhase(
                    ctx,
                    await insertBlankCompetition(ctx),
                    "Main",
                    "a"
                  )
                : await insertProjectPhase(
                    ctx,
                    await insertBlankProject(ctx),
                    "Main",
                    "a"
                  )
            const taskId = await insertSeedTask(ctx, {
              parent: { type: "phases", id: phaseId },
              order: "a",
              status: "to-do",
            })
            const unrelatedId = await insertSeedTask(ctx, {
              parent: { type: "phases", id: phaseId },
              order: "b",
              status: "to-do",
            })
            if (role === "assignee") {
              await ctx.db.patch("tasks", taskId, { assigneeIds: [userId] })
            } else if (role === "user-owner" || role === "team-owner") {
              await ctx.db.patch("tasks", taskId, {
                assigneeIds: "assignable",
                owner:
                  role === "user-owner"
                    ? { type: "users", id: userId }
                    : { type: "teams", id: teamId },
              })
            } else {
              await ctx.db.patch("tasks", taskId, {
                status: "done",
                statusIntent: { type: "manual", status: "done" },
              })
              await ctx.db.insert("taskReviewers", {
                taskId,
                reviewer:
                  role === "user-reviewer"
                    ? { type: "users", id: userId }
                    : { type: "teams", id: teamId },
                approvedAt: null,
                approvedBy: null,
              })
            }
            const labelId = await ctx.db.insert("taskLabels", {
              code: "OPS",
              name: "Operations",
              color: "slate",
            })
            await ctx.db.insert("taskLabelAssignments", { taskId, labelId })
            return { userId, taskId, unrelatedId, teamId }
          }
        )
        const client = t.withIdentity({ subject: userId })
        const details = await client.query(api.tasks.queries.getDetails, {
          id: taskId,
        })
        expect(details.task._id).toBe(taskId)
        await expect(
          client.query(api.tasks.queries.getDetails, { id: unrelatedId })
        ).rejects.toThrow()
        const rows = await client.query(api.tasks.board.listForBoard, {})
        expect(rows.map((row) => row.task._id)).toEqual([taskId])
        const home = await client.query(api.dashboard.queries.getHome, {
          today: "2026-10-07",
        })
        expect(
          [...home.actionNeeded, ...home.assignedWork].map(
            (action) => action.task
          )
        ).toEqual(rows)
        expect(home.competitionsWithWork).toEqual([])
        expect(home.projectsWithWork).toEqual([])
        expect(rows[0].labels.map((label) => label.code)).toEqual(["OPS"])
        if (role === "assignee") {
          expect(
            await client.query(api.tasks.board.listForBoard, {
              assignedToMe: true,
            })
          ).toEqual(rows)
        }
        if (role === "team-owner") {
          expect(
            await client.query(api.tasks.board.listForBoard, { teamId })
          ).toEqual(rows)
          expect(
            await client.query(api.tasks.board.listForBoard, {
              teamId,
              assignedToMe: true,
            })
          ).toEqual([])
        }
      }
    )
  }

  test("interleaved competition and project roots retain global creation order in combined scopes", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)
    const { teamId, taskIds } = await t.run(async (ctx) => {
      const teamId = await ctx.db.insert("teams", { name: "Operations" })
      const phaseA = await insertCompetitionPhase(
        ctx,
        await insertBlankCompetition(ctx),
        "Main",
        "a"
      )
      const phaseB = await insertCompetitionPhase(
        ctx,
        await insertBlankCompetition(ctx),
        "Main",
        "a"
      )
      const phaseC = await insertProjectPhase(
        ctx,
        await insertBlankProject(ctx),
        "Main",
        "a"
      )
      const taskIds = []
      for (const phaseId of [phaseA, phaseB, phaseC, phaseA, phaseB, phaseC]) {
        const taskId = await insertSeedTask(ctx, {
          parent: { type: "phases", id: phaseId },
          order: String(taskIds.length),
          status: "to-do",
        })
        await ctx.db.patch("tasks", taskId, {
          assigneeIds: [userId],
          owner: { type: "teams", id: teamId },
        })
        taskIds.push(taskId)
      }
      return { teamId, taskIds }
    })
    const all = await client.query(api.tasks.board.listForBoard, {})
    expect(all.map((row) => row.task._id)).toEqual(taskIds)
    for (const scope of [
      { teamId },
      { assignedToMe: true },
      { teamId, assignedToMe: true },
    ]) {
      expect(await client.query(api.tasks.board.listForBoard, scope)).toEqual(
        all
      )
    }
    expect(
      await client.query(api.tasks.board.listForBoard, {
        teamId,
        assignedToMe: true,
        effectiveStatuses: ["to-do"],
      })
    ).toEqual(all)
  })
})
