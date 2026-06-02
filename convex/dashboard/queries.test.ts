/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

async function insertTask(
  ctx: MutationCtx,
  input: {
    name: string
    phaseId: Id<"phases">
    order: string
    status: Doc<"tasks">["status"]
    assigneeIds?: Doc<"tasks">["assigneeIds"]
    owner?: Doc<"tasks">["owner"]
    dueDate?: string | null
  }
) {
  return await ctx.db.insert("tasks", {
    name: input.name,
    description: null,
    parent: { type: "phases", id: input.phaseId },
    order: input.order,
    assigneeIds: input.assigneeIds ?? null,
    owner: input.owner ?? null,
    dueDate: input.dueDate ?? null,
    kind: "standard",
    status: input.status,
    statusIntent: { type: "manual", status: input.status },
  })
}

async function insertCompetitionWithPhase(
  ctx: MutationCtx,
  input: {
    name: string
    from: string | null
    sortKey: string
  }
) {
  const competitionId = await insertBlankCompetition(ctx)
  await ctx.db.patch("competitions", competitionId, {
    name: input.name,
    compDates: { from: input.from, to: input.from },
  })
  const phaseId = await insertCompetitionPhase(
    ctx,
    competitionId,
    "Pre-Competition",
    input.sortKey,
    "sky"
  )
  await ctx.db.patch("competitions", competitionId, { phaseId })
  return { competitionId, phaseId }
}

describe("dashboard home", () => {
  test("returns only actions scoped to the current user or their teams", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)

    const ids = await t.run(async (ctx) => {
      const otherUserId = await insertTestUser(ctx, "Other User")
      const volunteerTeam = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.VOLUNTEER))
        .unique()
      if (volunteerTeam === null) {
        throw new Error("Volunteer team was not seeded")
      }
      const { phaseId } = await insertCompetitionWithPhase(ctx, {
        name: "Action Open",
        from: "2999-01-01",
        sortKey: "a",
      })

      const reviewTaskId = await insertTask(ctx, {
        name: "Needs my review",
        phaseId,
        order: "a",
        status: "awaiting-review",
      })
      const assignedBlockingTaskId = await insertTask(ctx, {
        name: "Assigned blocking task",
        phaseId,
        order: "b",
        status: "to-do",
        assigneeIds: [userId],
      })
      const blockedTargetTaskId = await insertTask(ctx, {
        name: "Blocked target task",
        phaseId,
        order: "c",
        status: "to-do",
      })
      const overdueTaskId = await insertTask(ctx, {
        name: "Assigned overdue",
        phaseId,
        order: "d",
        status: "to-do",
        assigneeIds: [userId],
        dueDate: "2000-01-01",
      })
      const ownedUnassignedTaskId = await insertTask(ctx, {
        name: "Owned unassigned",
        phaseId,
        order: "e",
        status: "to-do",
        owner: { type: "users", id: userId },
      })
      const teamOwnedUnassignedTaskId = await insertTask(ctx, {
        name: "Team owned unassigned",
        phaseId,
        order: "f",
        status: "to-do",
        assigneeIds: "assignable",
        owner: { type: "teams", id: volunteerTeam._id },
      })
      const inProgressTaskId = await insertTask(ctx, {
        name: "Assigned in progress",
        phaseId,
        order: "g",
        status: "in-progress",
        assigneeIds: [userId],
      })
      const todoTaskId = await insertTask(ctx, {
        name: "Assigned to do",
        phaseId,
        order: "h",
        status: "to-do",
        assigneeIds: [userId],
      })
      const assignedAwaitingOtherReviewTaskId = await insertTask(ctx, {
        name: "Assigned awaiting someone else",
        phaseId,
        order: "i",
        status: "awaiting-review",
        assigneeIds: [userId],
      })
      const globalReviewTaskId = await insertTask(ctx, {
        name: "Global review task",
        phaseId,
        order: "j",
        status: "awaiting-review",
      })
      const globalClaimableTaskId = await insertTask(ctx, {
        name: "Global claimable task",
        phaseId,
        order: "k",
        status: "to-do",
        assigneeIds: "assignable",
      })
      const doneTaskId = await insertTask(ctx, {
        name: "Done task",
        phaseId,
        order: "l",
        status: "done",
        assigneeIds: [userId],
        dueDate: "2000-01-01",
      })
      const cancelledTaskId = await insertTask(ctx, {
        name: "Cancelled task",
        phaseId,
        order: "m",
        status: "cancelled",
      })

      await ctx.db.insert("taskBlockers", {
        blockedTaskId: blockedTargetTaskId,
        blockingTaskId: assignedBlockingTaskId,
      })
      await ctx.db.insert("taskReviewers", {
        taskId: reviewTaskId,
        reviewer: { type: "users", id: userId },
        approvedAt: null,
        approvedBy: null,
      })
      await ctx.db.insert("taskReviewers", {
        taskId: globalReviewTaskId,
        reviewer: { type: "users", id: otherUserId },
        approvedAt: null,
        approvedBy: null,
      })
      await ctx.db.insert("taskReviewers", {
        taskId: assignedAwaitingOtherReviewTaskId,
        reviewer: { type: "users", id: otherUserId },
        approvedAt: null,
        approvedBy: null,
      })

      return {
        reviewTaskId,
        assignedBlockingTaskId,
        blockedTargetTaskId,
        overdueTaskId,
        ownedUnassignedTaskId,
        teamOwnedUnassignedTaskId,
        inProgressTaskId,
        todoTaskId,
        assignedAwaitingOtherReviewTaskId,
        globalReviewTaskId,
        globalClaimableTaskId,
        doneTaskId,
        cancelledTaskId,
      }
    })

    const home = await client.query(api.dashboard.queries.getHome, {})
    const actionsByTaskId = new Map(
      [...home.actionNeeded, ...home.assignedWork].map((item) => [
        item.task.task._id,
        item,
      ])
    )

    expect(home.actionNeeded.map((item) => item.reason)).toEqual([
      "review",
      "blocking",
      "overdue",
      "unassigned-owned",
      "unassigned-owned",
    ])
    expect(home.assignedWork.map((item) => item.reason)).toEqual([
      "in-progress",
      "assigned-todo",
      "assigned-open",
    ])
    expect(actionsByTaskId.get(ids.reviewTaskId)?.primaryAction).toBe("view")
    expect(actionsByTaskId.get(ids.assignedBlockingTaskId)?.primaryAction).toBe(
      "start"
    )
    expect(actionsByTaskId.get(ids.assignedBlockingTaskId)?.explanation).toBe(
      "Blocking Blocked target task."
    )
    expect(actionsByTaskId.get(ids.overdueTaskId)?.primaryAction).toBe(
      "open-task"
    )
    expect(actionsByTaskId.get(ids.ownedUnassignedTaskId)?.primaryAction).toBe(
      "claim"
    )
    expect(
      actionsByTaskId.get(ids.teamOwnedUnassignedTaskId)?.primaryAction
    ).toBe("claim")
    expect(actionsByTaskId.get(ids.inProgressTaskId)?.primaryAction).toBe(
      "complete"
    )
    expect(actionsByTaskId.get(ids.todoTaskId)?.primaryAction).toBe("start")
    expect(
      actionsByTaskId.get(ids.assignedAwaitingOtherReviewTaskId)?.primaryAction
    ).toBe("open-task")
    expect(actionsByTaskId.has(ids.blockedTargetTaskId)).toBe(false)
    expect(actionsByTaskId.has(ids.globalReviewTaskId)).toBe(false)
    expect(actionsByTaskId.has(ids.globalClaimableTaskId)).toBe(false)
    expect(actionsByTaskId.has(ids.doneTaskId)).toBe(false)
    expect(actionsByTaskId.has(ids.cancelledTaskId)).toBe(false)
  })

  test("includes pending team reviews for teams the user belongs to", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)

    const teamReviewTaskId = await t.run(async (ctx) => {
      const volunteerTeam = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", TEAM_NAMES.VOLUNTEER))
        .unique()
      if (volunteerTeam === null) {
        throw new Error("Volunteer team was not seeded")
      }
      const { phaseId } = await insertCompetitionWithPhase(ctx, {
        name: "Team Review Open",
        from: "2999-01-01",
        sortKey: "a",
      })
      const teamTaskId = await insertTask(ctx, {
        name: "Needs team review",
        phaseId,
        order: "a",
        status: "awaiting-review",
      })
      await ctx.db.insert("taskReviewers", {
        taskId: teamTaskId,
        reviewer: { type: "teams", id: volunteerTeam._id },
        approvedAt: null,
        approvedBy: null,
      })
      return teamTaskId
    })

    const home = await client.query(api.dashboard.queries.getHome, {})
    const teamReviewAction = home.actionNeeded.find(
      (item) => item.task.task._id === teamReviewTaskId
    )

    expect(teamReviewAction).toMatchObject({
      reason: "review",
      primaryAction: "view",
    })
  })

  test("shows only competitions with active work and sorts by date then risk", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)

    await t.run(async (ctx) => {
      const soon = await insertCompetitionWithPhase(ctx, {
        name: "Soon Open",
        from: "2999-01-01",
        sortKey: "a",
      })
      const riskyA = await insertCompetitionWithPhase(ctx, {
        name: "Risky A",
        from: "2999-02-01",
        sortKey: "b",
      })
      const riskyB = await insertCompetitionWithPhase(ctx, {
        name: "Risky B",
        from: "2999-02-01",
        sortKey: "c",
      })
      const doneOnly = await insertCompetitionWithPhase(ctx, {
        name: "Done Only",
        from: "2999-03-01",
        sortKey: "d",
      })
      await insertCompetitionWithPhase(ctx, {
        name: "No Tasks",
        from: "2999-04-01",
        sortKey: "e",
      })

      await insertTask(ctx, {
        name: "Soon task",
        phaseId: soon.phaseId,
        order: "a",
        status: "to-do",
      })
      const riskyBlockedTaskId = await insertTask(ctx, {
        name: "Risky blocked",
        phaseId: riskyA.phaseId,
        order: "a",
        status: "in-progress",
      })
      const riskyBlockingTaskId = await insertTask(ctx, {
        name: "Risky blocking",
        phaseId: riskyA.phaseId,
        order: "b",
        status: "to-do",
      })
      await ctx.db.insert("taskBlockers", {
        blockedTaskId: riskyBlockedTaskId,
        blockingTaskId: riskyBlockingTaskId,
      })
      await insertTask(ctx, {
        name: "Risky B task",
        phaseId: riskyB.phaseId,
        order: "a",
        status: "to-do",
      })
      await insertTask(ctx, {
        name: "Done task",
        phaseId: doneOnly.phaseId,
        order: "a",
        status: "done",
      })
    })

    const home = await client.query(api.dashboard.queries.getHome, {})

    expect(
      home.competitionsWithWork.map((competition) => competition.name)
    ).toEqual(["Soon Open", "Risky A", "Risky B"])
    expect(
      home.competitionsWithWork.find(
        (competition) => competition.name === "Risky A"
      )
    ).toMatchObject({
      activeTaskCount: 2,
      blockedTaskCount: 1,
    })
  })

  test("returns every assigned action and caps competition summaries", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)

    await t.run(async (ctx) => {
      for (let index = 0; index < 10; index += 1) {
        const { phaseId } = await insertCompetitionWithPhase(ctx, {
          name: `Capped Open ${String(index)}`,
          from: `2999-01-${String(index + 1).padStart(2, "0")}`,
          sortKey: `a${String(index).padStart(2, "0")}`,
        })
        await insertTask(ctx, {
          name: `Assigned ${String(index)}`,
          phaseId,
          order: "a",
          status: "to-do",
          assigneeIds: [userId],
        })
      }
    })

    const home = await client.query(api.dashboard.queries.getHome, {})

    expect(home.actionNeeded).toHaveLength(0)
    expect(home.assignedWork).toHaveLength(10)
    expect(home.competitionsWithWork).toHaveLength(6)
  })

  test("returns empty lists when no actions or competition work remain", async () => {
    const t = convexTest(schema, modules)
    const { client, userId } = await withVolunteerTestClient(t)

    await t.run(async (ctx) => {
      const { phaseId } = await insertCompetitionWithPhase(ctx, {
        name: "Finished Open",
        from: "2999-01-01",
        sortKey: "a",
      })
      await insertTask(ctx, {
        name: "Finished task",
        phaseId,
        order: "a",
        status: "done",
        assigneeIds: [userId],
      })
    })

    const home = await client.query(api.dashboard.queries.getHome, {})

    expect(home.actionNeeded).toEqual([])
    expect(home.assignedWork).toEqual([])
    expect(home.competitionsWithWork).toEqual([])
  })
})
