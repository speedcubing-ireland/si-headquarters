/// <reference types="vite/client" />

import { NO_CURRENT_PHASE_PROGRESS } from "@/convex/competitions/phaseSnapshot"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import schema from "@/convex/schema"
import {
  ensureVolunteerMembership,
  insertCompetitionPhase,
  insertSeedTask,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("competition queries", () => {
  test("people query hydrates competition people independently", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId, compLeadId, leadDelegateId, organiserId } =
      await t.run(async (ctx) => {
        const viewerId = await ctx.db.insert("users", {
          name: "Viewer",
        })
        await ensureVolunteerMembership(ctx, viewerId)
        const compLeadId = await ctx.db.insert("users", {
          name: "Comp Lead",
        })
        const leadDelegateId = await ctx.db.insert("users", {
          name: "Lead Delegate",
        })
        const organiserId = await ctx.db.insert("users", {
          name: "Organiser",
        })
        const competitionId = await ctx.db.insert("competitions", {
          name: "Spring Open",
          description: null,
          people: {
            compLead: compLeadId,
            leadDelegate: leadDelegateId,
            organisers: [organiserId],
          },
          compDates: {
            from: null,
            to: null,
          },
          phaseId: null,
          updateId: null,
        })

        return {
          viewerId,
          competitionId,
          compLeadId,
          leadDelegateId,
          organiserId,
        }
      })
    const viewer = t.withIdentity({ subject: viewerId })

    const people = await viewer.query(api.competitions.queries.getPeople, {
      id: competitionId,
    })

    expect(people.competition._id).toBe(competitionId)
    expect(people.people.compLead?._id).toBe(compLeadId)
    expect(people.people.leadDelegate?._id).toBe(leadDelegateId)
    expect(people.people.organisers.map((user) => user._id)).toEqual([
      organiserId,
    ])
  })

  test("current update query returns update author and handles empty updates", async () => {
    const t = convexTest(schema, modules)
    const {
      viewerId,
      competitionWithUpdateId,
      competitionWithoutUpdateId,
      authorId,
    } = await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", {
        name: "Viewer",
      })
      await ensureVolunteerMembership(ctx, viewerId)
      const authorId = await ctx.db.insert("users", {
        name: "Update Author",
      })
      const competitionWithUpdateId = await insertCompetition(ctx, "With")
      const competitionWithoutUpdateId = await insertCompetition(ctx, "Empty")
      const updateId = await ctx.db.insert("competitionUpdates", {
        competitionId: competitionWithUpdateId,
        authorId,
        body: "Hello world",
        editedAt: 1,
      })
      await ctx.db.patch("competitions", competitionWithUpdateId, {
        updateId,
      })

      return {
        viewerId,
        competitionWithUpdateId,
        competitionWithoutUpdateId,
        authorId,
      }
    })
    const viewer = t.withIdentity({ subject: viewerId })

    const withUpdate = await viewer.query(
      api.competitions.queries.getCurrentUpdate,
      {
        id: competitionWithUpdateId,
      }
    )
    const withoutUpdate = await viewer.query(
      api.competitions.queries.getCurrentUpdate,
      {
        id: competitionWithoutUpdateId,
      }
    )

    expect(withUpdate.update?.body).toBe("Hello world")
    expect(withUpdate.update?.author?._id).toBe(authorId)
    expect(withoutUpdate.update).toBeNull()
  })

  test("current phase progress returns null phase and zero progress without a current phase", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId } = await t.run(async (ctx) => {
      const viewerId = await insertViewer(ctx)
      const competitionId = await insertCompetition(ctx, "No Phase")
      return { viewerId, competitionId }
    })

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result).toEqual(NO_CURRENT_PHASE_PROGRESS)
  })

  test("current phase progress counts only tasks in the selected phase", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId, currentPhaseId } = await t.run(
      async (ctx) => {
        const viewerId = await insertViewer(ctx)
        const competitionId = await insertCompetition(ctx, "Spring Open")
        const currentPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Operations",
          "b",
          "sky"
        )
        const otherPhaseId = await insertCompetitionPhase(
          ctx,
          competitionId,
          "Concept",
          "a",
          "amber"
        )
        await ctx.db.patch("competitions", competitionId, {
          phaseId: currentPhaseId,
        })

        await insertSeedTask(ctx, {
          name: "Current phase task",
          parent: { type: "phases", id: currentPhaseId },
          order: "a",
          status: "done",
        })
        await insertSeedTask(ctx, {
          name: "Other phase task",
          parent: { type: "phases", id: otherPhaseId },
          order: "a",
          status: "to-do",
        })

        return { viewerId, competitionId, currentPhaseId }
      }
    )

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result.phase).toEqual({
      _id: currentPhaseId,
      name: "Operations",
      color: "sky",
    })
    expect(result.progress).toEqual({
      total: 1,
      done: 1,
      cancelled: 0,
      incomplete: 0,
      inProgress: 0,
      blocked: 0,
      completionPercent: 100,
    })
  })

  test("current phase progress computes terminal completion and open task buckets", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId } = await t.run(async (ctx) => {
      const viewerId = await insertViewer(ctx)
      const competitionId = await insertCompetition(ctx, "Spring Open")
      const phaseId = await insertCompetitionPhase(ctx, competitionId, "Launch", "a")
      await ctx.db.patch("competitions", competitionId, { phaseId })

      await insertSeedTask(ctx, {
        name: "Done task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "done",
      })
      await insertSeedTask(ctx, {
        name: "Done task 2",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "done",
      })
      await insertSeedTask(ctx, {
        name: "Cancelled task",
        parent: { type: "phases", id: phaseId },
        order: "c",
        status: "cancelled",
      })
      await insertSeedTask(ctx, {
        name: "Open task",
        parent: { type: "phases", id: phaseId },
        order: "d",
        status: "to-do",
      })

      return { viewerId, competitionId }
    })

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result.progress).toEqual({
      total: 4,
      done: 2,
      cancelled: 1,
      incomplete: 1,
      inProgress: 1,
      blocked: 0,
      completionPercent: 75,
    })
  })

  test("current phase progress uses flow effective statuses for phase tasks", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId } = await t.run(async (ctx) => {
      const viewerId = await insertViewer(ctx)
      const competitionId = await insertCompetition(ctx, "Spring Open")
      const phaseId = await insertCompetitionPhase(ctx, competitionId, "Launch", "a")
      await ctx.db.patch("competitions", competitionId, { phaseId })

      const flowId = await insertSeedTask(ctx, {
        name: "Flow task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        kind: "flow",
        status: "to-do",
      })
      await insertSeedTask(ctx, {
        name: "Completed step",
        parent: { type: "tasks", id: flowId },
        order: "a",
        status: "done",
      })
      await insertSeedTask(ctx, {
        name: "Current step",
        parent: { type: "tasks", id: flowId },
        order: "b",
        status: "in-progress",
      })
      await insertSeedTask(ctx, {
        name: "Future step",
        parent: { type: "tasks", id: flowId },
        order: "c",
        status: "to-do",
      })

      return { viewerId, competitionId }
    })

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result.progress).toEqual({
      total: 1,
      done: 0,
      cancelled: 0,
      incomplete: 1,
      inProgress: 1,
      blocked: 0,
      completionPercent: 0,
    })
  })

  test("current phase progress ignores completed blockers and completed blocked tasks", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId } = await t.run(async (ctx) => {
      const viewerId = await insertViewer(ctx)
      const competitionId = await insertCompetition(ctx, "Spring Open")
      const phaseId = await insertCompetitionPhase(ctx, competitionId, "Launch", "a")
      await ctx.db.patch("competitions", competitionId, { phaseId })

      const doneWithBlockerId = await insertSeedTask(ctx, {
        name: "Done with blocker",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "done",
      })
      const completedBlockerId = await insertSeedTask(ctx, {
        name: "Completed blocker",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "done",
      })
      const openBlockedId = await insertSeedTask(ctx, {
        name: "Open blocked task",
        parent: { type: "phases", id: phaseId },
        order: "c",
        status: "to-do",
      })
      const openBlockerId = await insertSeedTask(ctx, {
        name: "Open blocker",
        parent: { type: "phases", id: phaseId },
        order: "d",
        status: "in-progress",
      })

      await ctx.db.insert("taskBlockers", {
        blockedTaskId: doneWithBlockerId,
        blockingTaskId: openBlockerId,
      })
      await ctx.db.insert("taskBlockers", {
        blockedTaskId: openBlockedId,
        blockingTaskId: completedBlockerId,
      })

      return { viewerId, competitionId }
    })

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result.progress).toEqual({
      total: 4,
      done: 2,
      cancelled: 0,
      incomplete: 2,
      inProgress: 2,
      blocked: 0,
      completionPercent: 50,
    })
  })

  test("current phase progress counts open tasks with at least one open blocker", async () => {
    const t = convexTest(schema, modules)
    const { viewerId, competitionId } = await t.run(async (ctx) => {
      const viewerId = await insertViewer(ctx)
      const competitionId = await insertCompetition(ctx, "Spring Open")
      const phaseId = await insertCompetitionPhase(ctx, competitionId, "Launch", "a")
      await ctx.db.patch("competitions", competitionId, { phaseId })

      const blockedId = await insertSeedTask(ctx, {
        name: "Blocked task",
        parent: { type: "phases", id: phaseId },
        order: "a",
        status: "to-do",
      })
      const blockerId = await insertSeedTask(ctx, {
        name: "Blocking task",
        parent: { type: "phases", id: phaseId },
        order: "b",
        status: "in-progress",
      })

      await ctx.db.insert("taskBlockers", {
        blockedTaskId: blockedId,
        blockingTaskId: blockerId,
      })

      return { viewerId, competitionId }
    })

    const result = await getPhaseProgress(t, viewerId, competitionId)

    expect(result.progress).toEqual({
      total: 2,
      done: 0,
      cancelled: 0,
      incomplete: 2,
      inProgress: 1,
      blocked: 1,
      completionPercent: 0,
    })
  })
})

async function insertViewer(ctx: MutationCtx) {
  const viewerId = await ctx.db.insert("users", { name: "Viewer" })
  await ensureVolunteerMembership(ctx, viewerId)
  return viewerId
}

async function getPhaseProgress(
  t: ReturnType<typeof convexTest>,
  viewerId: Id<"users">,
  competitionId: Id<"competitions">
) {
  return await t.withIdentity({ subject: viewerId }).query(
    api.competitions.queries.getCurrentPhaseProgress,
    { id: competitionId }
  )
}

async function insertCompetition(
  ctx: MutationCtx,
  name: string
): Promise<Id<"competitions">> {
  return await ctx.db.insert("competitions", {
    name,
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

