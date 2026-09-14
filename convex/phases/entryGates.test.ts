/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import { resolveBlockedPhaseIds } from "@/convex/phases/entryGates"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertSeedTask,
  phasesForCompetition,
  seedPhaseTasks,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"

/**
 * The blocked phases as the sync resolves them, by template key so the
 * assertions read as phase names rather than ids.
 */
async function blockedKeysFrom(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">,
  currentPhaseKey: TemplatePhaseKey | null
): Promise<string[]> {
  const phases = await phasesForCompetition(t, competitionId)
  const current =
    currentPhaseKey === null
      ? null
      : (phases.find((phase) => phase.templateKey === currentPhaseKey) ?? null)
  if (currentPhaseKey !== null && current === null) {
    throw new Error(`No ${currentPhaseKey} phase seeded`)
  }

  // Unwrapped inside the run: a Set is not a value convex-test can return.
  const blocked = await t.run(async (ctx) => [
    ...(await resolveBlockedPhaseIds(
      ctx,
      await listPhasesForOwnerBounded(ctx, {
        type: "competitions",
        id: competitionId,
      }),
      current?._id ?? null
    )),
  ])

  return phases
    .filter((phase) => blocked.includes(phase._id))
    .map((phase) => phase.templateKey ?? "")
    .sort()
}

describe("resolveBlockedPhaseIds", () => {
  test("blocks Pre-Announcement while a Concept task is outstanding", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "to-do"])

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([
      "pre-announcement",
    ])
  })

  test("blocks nothing once every Concept task is done", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "done"])

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([])
  })

  test("a cancelled Concept task does not block", async () => {
    // `cancelled` is terminal in this codebase, so the work is settled even
    // though it was never done.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done", "cancelled"])

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([])
  })

  test("an outstanding subtask holds its parent, and so the gate", async () => {
    // Only direct children of the phase are counted, so this only blocks if the
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

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([
      "pre-announcement",
    ])
  })

  test("a Concept phase with no tasks blocks nothing", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([])
  })

  test("a competition with no Concept phase blocks nothing", async () => {
    // Nothing to finish, and blocking would strand it short of
    // Pre-Announcement until the WCA announced it.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "pre-announcement",
      omit: ["concept"],
    })

    expect(await blockedKeysFrom(t, competitionId, "pre-announcement")).toEqual(
      []
    )
  })

  test("tasks in a later phase do not block", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "concept",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["done"])
    await seedPhaseTasks(t, competitionId, "pre-announcement", ["to-do"])

    expect(await blockedKeysFrom(t, competitionId, "concept")).toEqual([])
  })

  test("a competition with no phase yet still resolves the gate", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t)
    await seedPhaseTasks(t, competitionId, "concept", ["to-do"])

    expect(await blockedKeysFrom(t, competitionId, null)).toEqual([
      "pre-announcement",
    ])
  })

  test("a gate the competition is already past is not evaluated", async () => {
    // Pre-Announcement is behind the current phase, so it can never be entered
    // and its Concept tasks are never read.
    const t = convexTest(schema, modules)
    const { competitionId } = await seedTemplateCompetition(t, {
      startingPhase: "announced",
    })
    await seedPhaseTasks(t, competitionId, "concept", ["to-do"])

    expect(await blockedKeysFrom(t, competitionId, "announced")).toEqual([])
  })
})
