/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { resolveMilestoneGates } from "@/convex/phases/milestoneGates"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import {
  insertSeedTask,
  phasesForCompetition,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"

/** The gates as the sync resolves them, for a seeded competition. */
async function gatesFor(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">
) {
  return await t.run(async (ctx) =>
    resolveMilestoneGates(
      ctx,
      await listPhasesForOwnerBounded(ctx, {
        type: "competitions",
        id: competitionId,
      })
    )
  )
}

/** Tasks in one phase, given as their statuses, in order. */
async function seedPhaseTasks(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">,
  phaseKey: TemplatePhaseKey,
  statuses: readonly TaskStatus[]
): Promise<Id<"tasks">[]> {
  const phases = await phasesForCompetition(t, competitionId)
  const phase = phases.find((candidate) => candidate.templateKey === phaseKey)
  if (phase === undefined) throw new Error(`No ${phaseKey} phase seeded`)

  return await t.run(async (ctx) => {
    const ids: Id<"tasks">[] = []
    for (const [index, status] of statuses.entries()) {
      ids.push(
        await insertSeedTask(ctx, {
          parent: { type: "phases", id: phase._id },
          order: `a${String(index)}`,
          status,
        })
      )
    }
    return ids
  })
}

describe("resolveMilestoneGates", () => {
  test("holds while a Concept task is outstanding", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "to-do"])

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: false,
    })
  })

  test("opens once every Concept task is done", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "done"])

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: true,
    })
  })

  test("a cancelled Concept task does not hold the gate", async () => {
    // `cancelled` is terminal in this codebase, so the work is settled even
    // though it was never done.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "cancelled"])

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: true,
    })
  })

  test("an outstanding subtask holds its parent, and so the gate", async () => {
    // Only direct children of the phase are counted, so this only holds if the
    // parent's effective status folds its subtasks in.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    const [parentId] = await seedPhaseTasks(t, competitionId, "concept", [
      "done",
    ])
    await t.run(async (ctx) => {
      await insertSeedTask(ctx, {
        parent: { type: "tasks", id: parentId },
        order: "a0",
        status: "to-do",
      })
    })

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: false,
    })
  })

  test("a Concept phase with no tasks is complete", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: true,
    })
  })

  test("a competition with no Concept phase is complete", async () => {
    // Nothing to finish, and holding would stall it short of Pre-Announcement
    // until the WCA announced it.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "pre-announcement",
      omit: ["concept"],
    })

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: true,
    })
  })

  test("tasks in a later phase do not hold the gate", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done"])
    await seedPhaseTasks(t, competitionId, "pre-announcement", ["to-do"])

    expect(await gatesFor(t, competitionId)).toEqual({
      conceptTasksComplete: true,
    })
  })
})
