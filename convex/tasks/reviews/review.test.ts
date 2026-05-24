/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"

type TaskSeed = {
  parent: Doc<"tasks">["parent"]
  order: string
  status?: Doc<"tasks">["status"]
}

async function insertUser(
  ctx: MutationCtx,
  name = "Test User"
): Promise<Id<"users">> {
  return await ctx.db.insert("users", { name })
}

async function insertTeam(
  ctx: MutationCtx,
  name = "Test Team"
): Promise<Id<"teams">> {
  return await ctx.db.insert("teams", { name })
}

async function insertPhase(ctx: MutationCtx): Promise<Id<"phases">> {
  const competitionId = await ctx.db.insert("competitions", {
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

  return await ctx.db.insert("phases", {
    name: "Setup",
    owner: {
      type: "competitions",
      id: competitionId,
    },
    sortKey: "a",
    color: "gray",
  })
}

async function insertTask(
  ctx: MutationCtx,
  seed: TaskSeed
): Promise<Id<"tasks">> {
  const status = seed.status ?? "backlog"

  return await ctx.db.insert("tasks", {
    name: `Task ${seed.order}`,
    description: null,
    parent: seed.parent,
    order: seed.order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: "standard",
    status,
    statusIntent: { type: "manual", status },
  })
}

async function seedPhaseTask(
  ctx: MutationCtx,
  seed: Omit<TaskSeed, "parent">
): Promise<Id<"tasks">> {
  const phaseId = await insertPhase(ctx)
  return await insertTask(ctx, {
    ...seed,
    parent: { type: "phases", id: phaseId },
  })
}

describe("task reviews", () => {
  test("reports no reviews", async () => {
    const t = convexTest(schema, modules)
    const user = t.withIdentity({ subject: "test-user" })
    const taskId = await t.run(async (ctx) =>
      seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
    )

    const review = await user.query(api.tasks.reviews.queries.getForTask, {
      taskId,
    })

    expect(review).toMatchObject({
      status: "not-required",
      hasReviews: false,
      hasPendingReviews: false,
      isApproved: false,
      isOverridden: false,
      override: null,
    })
  })

  test("adds user and team reviewers idempotently and reports pending reviews", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId, reviewerId, teamId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const reviewerId = await insertUser(ctx, "Reviewer")
      const teamId = await insertTeam(ctx, "Competitions Team")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
      return { actorId, taskId, reviewerId, teamId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "teams", id: teamId },
    })

    const details = await actor.query(
      api.tasks.reviews.queries.getDetailsForTask,
      { taskId }
    )

    expect(details.state).toMatchObject({
      status: "pending",
      hasReviews: true,
      hasPendingReviews: true,
      isApproved: false,
      isOverridden: false,
    })
    expect(details.reviewers).toHaveLength(2)
    expect(
      details.reviewers.map((reviewer) => reviewer.reviewer.type).sort()
    ).toEqual(["teams", "users"])
  })

  test("requires every reviewer to approve and supports revoking approvals", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId, reviewerId, teamId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const reviewerId = await insertUser(ctx, "Reviewer")
      const teamId = await insertTeam(ctx, "Graphics Team")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
      return { actorId, taskId, reviewerId, teamId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "teams", id: teamId },
    })
    await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })

    const review = await actor.query(api.tasks.reviews.queries.getForTask, {
      taskId,
    })
    expect(review).toMatchObject({
      status: "pending",
      hasPendingReviews: true,
      isApproved: false,
    })

    await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
      taskId,
      reviewer: { type: "teams", id: teamId },
    })
    let details = await actor.query(
      api.tasks.reviews.queries.getDetailsForTask,
      {
        taskId,
      }
    )
    expect(details.state).toMatchObject({
      status: "approved",
      hasPendingReviews: false,
      isApproved: true,
    })
    expect(
      details.reviewers.every(
        (reviewer) =>
          reviewer.approvedAt !== null && reviewer.approvedBy === actorId
      )
    ).toBe(true)

    await actor.mutation(api.tasks.reviews.mutations.revokeReviewerApproval, {
      taskId,
      reviewer: { type: "teams", id: teamId },
    })
    details = await actor.query(api.tasks.reviews.queries.getDetailsForTask, {
      taskId,
    })
    expect(details.state).toMatchObject({
      status: "pending",
      hasPendingReviews: true,
      isApproved: false,
    })
    expect(
      details.reviewers.find((reviewer) => reviewer.reviewer.type === "teams")
    ).toMatchObject({
      approvedAt: null,
      approvedBy: null,
    })
  })

  test("removing the last reviewer returns the task to not-required", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const reviewerId = await insertUser(ctx, "Reviewer")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
      return { actorId, taskId, reviewerId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.removeReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    const details = await actor.query(
      api.tasks.reviews.queries.getDetailsForTask,
      { taskId }
    )

    expect(details.state).toMatchObject({
      status: "not-required",
      hasReviews: false,
      hasPendingReviews: false,
      isApproved: false,
    })
    expect(details.reviewers).toEqual([])
  })

  test("approval override marks reviews approved until the override is removed", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId, reviewerId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const reviewerId = await insertUser(ctx, "Reviewer")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
      return { actorId, taskId, reviewerId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.overrideApproval, {
      taskId,
    })
    let details = await actor.query(
      api.tasks.reviews.queries.getDetailsForTask,
      {
        taskId,
      }
    )

    expect(details.state).toMatchObject({
      status: "approved",
      hasReviews: true,
      hasPendingReviews: false,
      isApproved: true,
      isOverridden: true,
    })
    expect(details.override).toMatchObject({
      taskId,
      overriddenBy: actorId,
    })

    await actor.mutation(api.tasks.reviews.mutations.removeApprovalOverride, {
      taskId,
    })
    details = await actor.query(api.tasks.reviews.queries.getDetailsForTask, {
      taskId,
    })
    expect(details.state).toMatchObject({
      status: "pending",
      hasPendingReviews: true,
      isApproved: false,
      isOverridden: false,
    })
    expect(details.override).toBe(null)
  })

  test("returns UI reviewer details with reviewer names and override public user", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId, reviewerId, teamId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const reviewerId = await insertUser(ctx, "Reviewer")
      const teamId = await insertTeam(ctx, "Competitions Team")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })
      return { actorId, taskId, reviewerId, teamId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.addReviewer, {
      taskId,
      reviewer: { type: "teams", id: teamId },
    })
    await actor.mutation(api.tasks.reviews.mutations.approveReviewer, {
      taskId,
      reviewer: { type: "users", id: reviewerId },
    })
    await actor.mutation(api.tasks.reviews.mutations.overrideApproval, {
      taskId,
    })

    const details = await actor.query(
      api.tasks.reviews.queries.getReviewerDetailsForTask,
      { taskId }
    )

    expect(details.state).toMatchObject({
      status: "approved",
      hasReviews: true,
      hasPendingReviews: false,
      isApproved: true,
      isOverridden: true,
    })
    expect(details.reviewers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewer: { type: "users", id: reviewerId },
          name: "Reviewer",
          approved: true,
        }),
        expect.objectContaining({
          reviewer: { type: "teams", id: teamId },
          name: "Competitions Team",
          approved: false,
        }),
      ])
    )
    expect(details.override).toMatchObject({
      overriddenBy: {
        _id: actorId,
        name: "Actor",
      },
    })
  })

  test("lists potential reviewers grouped as teams and users", async () => {
    const t = convexTest(schema, modules)
    const { actorId, teamId, userId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const userId = await insertUser(ctx, "Reviewer")
      const teamId = await insertTeam(ctx, "Competitions Team")

      return { actorId, teamId, userId }
    })
    const actor = t.withIdentity({ subject: actorId })

    const reviewers = await actor.query(
      api.tasks.reviews.queries.listPotentialReviewers,
      {}
    )

    expect(reviewers.teams).toEqual([
      {
        _id: teamId,
        name: "Competitions Team",
      },
    ])
    expect(reviewers.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: actorId,
          name: "Actor",
        }),
        expect.objectContaining({
          _id: userId,
          name: "Reviewer",
        }),
      ])
    )
  })

  test("review state reads are bounded by a per-task reviewer limit", async () => {
    const t = convexTest(schema, modules)
    const { actorId, taskId } = await t.run(async (ctx) => {
      const actorId = await insertUser(ctx, "Actor")
      const taskId = await seedPhaseTask(ctx, {
        order: "a",
        status: "to-do",
      })

      for (let index = 0; index < 101; index += 1) {
        const reviewerId = await insertUser(ctx, `Reviewer ${index}`)
        await ctx.db.insert("taskReviewers", {
          taskId,
          reviewer: { type: "users", id: reviewerId },
          approvedAt: null,
          approvedBy: null,
        })
      }

      return { actorId, taskId }
    })
    const actor = t.withIdentity({ subject: actorId })

    await expect(
      actor.query(api.tasks.reviews.queries.getDetailsForTask, { taskId })
    ).rejects.toThrow("Task has more than 100 reviewers")
  })
})
