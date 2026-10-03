/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import { ensureTeamByName } from "@/convex/teams/model"
import { modules } from "@/convex/test.setup"
import {
  insertSeedTask,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"

const PAY_VENUE_TASK_NAME = "Pay Venue Balance"
const EXISTING_TASK_NAME = "All expenses submitted"

/**
 * A templated competition whose Post-Competition phase holds an existing task,
 * as competitions created before the Pay Venue Balance task look.
 */
async function seedCompetitionMissingTask(
  t: TestConvex<typeof schema>,
  startingPhase: TemplatePhaseKey = "announced"
) {
  const { competitionId } = await seedTemplateCompetition(t, { startingPhase })

  return await t.run(async (ctx) => {
    await ensureTeamByName(ctx, TEAM_NAMES.FINANCE)

    const phases = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", competitionId)
      )
      .collect()
    const phase = phases.find((row) => row.templateKey === "post-competition")
    if (phase === undefined) throw new Error("Post-Competition phase missing")

    await insertSeedTask(ctx, {
      name: EXISTING_TASK_NAME,
      order: "a0",
      parent: { type: "phases", id: phase._id },
    })

    return { competitionId, phaseId: phase._id }
  })
}

async function readPhaseTasks(
  t: TestConvex<typeof schema>,
  phaseId: Id<"phases">
) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query("tasks")
        .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
          q.eq("parent.type", "phases").eq("parent.id", phaseId)
        )
        .collect()
  )
}

describe("addPayVenueBalanceTask", () => {
  test("adds the task last in the phase, in backlog, owned by Finance", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingTask(t)

    const result = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )

    expect(result).toEqual({ added: [competitionId], skipped: [] })

    const tasks = await readPhaseTasks(t, phaseId)
    expect(tasks.map((task) => task.name)).toEqual([
      EXISTING_TASK_NAME,
      PAY_VENUE_TASK_NAME,
    ])
    expect(tasks[1].status).toBe("backlog")
    expect(tasks[1].templateKey).toBe("pay-venue-balance")
    expect(tasks[1].owner?.type).toBe("teams")
  })

  test("adds the task as to-do when the competition is in Post-Competition", async () => {
    const t = convexTest(schema, modules)
    const { phaseId } = await seedCompetitionMissingTask(t, "post-competition")

    await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )

    const tasks = await readPhaseTasks(t, phaseId)
    const payVenue = tasks.find((task) => task.name === PAY_VENUE_TASK_NAME)
    expect(payVenue?.status).toBe("to-do")
    expect(payVenue?.statusIntent).toEqual({ type: "manual", status: "to-do" })
  })

  test("skips completed competitions", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingTask(
      t,
      "completed"
    )

    const result = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )

    expect(result).toEqual({
      added: [],
      skipped: [{ competitionId, reason: "competition is completed" }],
    })
    const tasks = await readPhaseTasks(t, phaseId)
    expect(tasks.map((task) => task.name)).toEqual([EXISTING_TASK_NAME])
  })

  test("only touches the given competitions", async () => {
    const t = convexTest(schema, modules)
    const first = await seedCompetitionMissingTask(t)
    const second = await seedCompetitionMissingTask(t)

    const result = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      { competitionIds: [second.competitionId] }
    )

    expect(result.added).toEqual([second.competitionId])
    const firstTasks = await readPhaseTasks(t, first.phaseId)
    expect(firstTasks.map((task) => task.name)).toEqual([EXISTING_TASK_NAME])
  })

  test("is safe to run twice", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingTask(t)

    await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )
    const second = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )

    expect(second).toEqual({
      added: [],
      skipped: [{ competitionId, reason: "already present" }],
    })
    const tasks = await readPhaseTasks(t, phaseId)
    expect(
      tasks.filter((task) => task.name === PAY_VENUE_TASK_NAME)
    ).toHaveLength(1)
  })

  test("reports a competition without a Post-Competition phase", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      omit: ["post-competition"],
    })

    const result = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      {}
    )

    expect(result).toEqual({
      added: [],
      skipped: [{ competitionId, reason: 'no "Post-Competition" phase' }],
    })
  })

  test("dryRun reports without writing", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingTask(t)

    const result = await t.mutation(
      internal.templates.payVenueBalanceBackfill.addPayVenueBalanceTask,
      { dryRun: true }
    )

    expect(result).toEqual({ added: [competitionId], skipped: [] })
    const tasks = await readPhaseTasks(t, phaseId)
    expect(tasks.map((task) => task.name)).toEqual([EXISTING_TASK_NAME])
  })
})
