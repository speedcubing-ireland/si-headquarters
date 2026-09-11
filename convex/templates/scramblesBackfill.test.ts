/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import schema from "@/convex/schema"
import { ensureTeamByName } from "@/convex/teams/model"
import { modules } from "@/convex/test.setup"
import { insertSeedTask, seedTemplateCompetition } from "@/convex/testHelpers"

const SCRAMBLES_TASK_NAME = "Scrambles generated"
const GROUPS_READY_TASK_NAME = "Groups Ready"

/**
 * A templated competition whose Pre-Competition phase holds a Groups Ready task,
 * as competitions created before the scrambles task look.
 */
async function seedCompetitionMissingScrambles(
  t: TestConvex<typeof schema>,
  options: { current?: boolean } = {}
) {
  const { competitionId } = await seedTemplateCompetition(t, {
    startingPhase: options.current === true ? "pre-competition" : "announced",
  })

  return await t.run(async (ctx) => {
    await ensureTeamByName(ctx, TEAM_NAMES.DELEGATES)

    const phases = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", competitionId)
      )
      .collect()
    const phase = phases.find((row) => row.templateKey === "pre-competition")
    if (phase === undefined) throw new Error("Pre-Competition phase missing")

    const groupsReadyId = await insertSeedTask(ctx, {
      name: GROUPS_READY_TASK_NAME,
      order: "a0",
      parent: { type: "phases", id: phase._id },
    })

    return { competitionId, groupsReadyId, phaseId: phase._id }
  })
}

async function readPhaseTasks(
  t: TestConvex<typeof schema>,
  phaseId: Id<"phases">
) {
  return await t.run(async (ctx) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "phases").eq("parent.id", phaseId)
      )
      .collect()
    const blockers = await ctx.db.query("taskBlockers").collect()
    return { tasks, blockers }
  })
}

describe("addScramblesTask", () => {
  test("adds the task last in the phase, in backlog, blocked by Groups Ready", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, groupsReadyId, phaseId } =
      await seedCompetitionMissingScrambles(t)

    const result = await t.mutation(
      internal.templates.scramblesBackfill.addScramblesTask,
      { competitionIds: [competitionId] }
    )

    expect(result).toMatchObject({ added: 1, skipped: [], warnings: [] })

    const { tasks, blockers } = await readPhaseTasks(t, phaseId)
    const ordered = [...tasks].sort((a, b) => a.order.localeCompare(b.order))
    expect(ordered.map((task) => task.name)).toEqual([
      GROUPS_READY_TASK_NAME,
      SCRAMBLES_TASK_NAME,
    ])

    const scrambles = ordered[1]
    expect(scrambles.status).toBe("backlog")
    expect(scrambles.owner?.type).toBe("teams")
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({
      blockedTaskId: scrambles._id,
      blockingTaskId: groupsReadyId,
    })
  })

  test("adds the task as to-do when the competition is in Pre-Competition", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingScrambles(
      t,
      {
        current: true,
      }
    )

    await t.mutation(internal.templates.scramblesBackfill.addScramblesTask, {
      competitionIds: [competitionId],
    })

    const { tasks } = await readPhaseTasks(t, phaseId)
    const scrambles = tasks.find((task) => task.name === SCRAMBLES_TASK_NAME)
    expect(scrambles?.status).toBe("to-do")
    expect(scrambles?.statusIntent).toEqual({ type: "manual", status: "to-do" })
  })

  test("is safe to run twice", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingScrambles(t)

    await t.mutation(internal.templates.scramblesBackfill.addScramblesTask, {
      competitionIds: [competitionId],
    })
    const second = await t.mutation(
      internal.templates.scramblesBackfill.addScramblesTask,
      { competitionIds: [competitionId] }
    )

    expect(second.added).toBe(0)
    expect(second.skipped).toEqual([
      { competitionId, reason: "already present" },
    ])

    const { tasks } = await readPhaseTasks(t, phaseId)
    expect(
      tasks.filter((task) => task.name === SCRAMBLES_TASK_NAME)
    ).toHaveLength(1)
  })

  test("reports a competition without a Pre-Competition phase", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      omit: ["pre-competition"],
    })

    const result = await t.mutation(
      internal.templates.scramblesBackfill.addScramblesTask,
      { competitionIds: [competitionId] }
    )

    expect(result.added).toBe(0)
    expect(result.skipped).toEqual([
      { competitionId, reason: 'no "Pre-Competition" phase' },
    ])
    const tasks = await t.run(
      async (ctx) => await ctx.db.query("tasks").collect()
    )
    expect(tasks).toEqual([])
  })

  test("warns when there is no Groups Ready task to block on", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "announced",
    })
    await t.run(async (ctx) => {
      await ensureTeamByName(ctx, TEAM_NAMES.DELEGATES)
    })

    const result = await t.mutation(
      internal.templates.scramblesBackfill.addScramblesTask,
      { competitionIds: [competitionId] }
    )

    expect(result.added).toBe(1)
    expect(result.warnings).toEqual([
      { competitionId, reason: 'no "Groups Ready" task to block on' },
    ])

    const blockers = await t.run(
      async (ctx) => await ctx.db.query("taskBlockers").collect()
    )
    expect(blockers).toEqual([])
  })

  test("dryRun reports without writing", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, phaseId } = await seedCompetitionMissingScrambles(t)

    const result = await t.mutation(
      internal.templates.scramblesBackfill.addScramblesTask,
      { competitionIds: [competitionId], dryRun: true }
    )

    expect(result).toMatchObject({ added: 1, skipped: [], warnings: [] })

    const { tasks } = await readPhaseTasks(t, phaseId)
    expect(tasks.map((task) => task.name)).toEqual([GROUPS_READY_TASK_NAME])
  })
})
