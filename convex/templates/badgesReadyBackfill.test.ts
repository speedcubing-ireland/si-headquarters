/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import type { TaskStatus } from "@/convex/tasks/status/validators"
import { modules } from "@/convex/test.setup"
import {
  insertSeedTask,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"

/**
 * A templated competition whose Groups Ready task still has the old
 * "Check-in sheet ready" subtask and its populate-checkin integration.
 */
async function seedCompetitionWithCheckInSheet(
  t: TestConvex<typeof schema>,
  options: {
    startingPhase?: TemplatePhaseKey
    status?: TaskStatus
    /** Leave the template key off, as competitions created before it existed. */
    withoutTemplateKey?: boolean
  } = {}
) {
  const { competitionId } = await seedTemplateCompetition(t, {
    startingPhase: options.startingPhase ?? "announced",
  })

  return await t.run(async (ctx) => {
    const phases = await ctx.db
      .query("phases")
      .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
        q.eq("owner.type", "competitions").eq("owner.id", competitionId)
      )
      .collect()
    const phase = phases.find((row) => row.templateKey === "pre-competition")
    if (phase === undefined) throw new Error("Pre-Competition phase missing")

    const groupsReadyId = await insertSeedTask(ctx, {
      name: "Groups Ready",
      order: "a0",
      parent: { type: "phases", id: phase._id },
      kind: "flow",
      templateKey: "groups-ready",
    })
    const taskId = await insertSeedTask(ctx, {
      name: "Check-in sheet ready",
      order: "a0",
      parent: { type: "tasks", id: groupsReadyId },
      status: options.status,
      templateKey:
        options.withoutTemplateKey === true
          ? undefined
          : "check-in-sheet-ready",
    })
    await ctx.db.insert("taskIntegrations", {
      taskId,
      integrationId: "sheet.populate-checkin",
      status: "idle",
      lastMessage: null,
      lastRunAt: null,
      runId: null,
      output: null,
    })

    return { competitionId, taskId }
  })
}

async function readTask(t: TestConvex<typeof schema>, taskId: Id<"tasks">) {
  return await t.run(async (ctx) => {
    const task = await ctx.db.get("tasks", taskId)
    const integrations = await ctx.db
      .query("taskIntegrations")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect()
    return {
      task,
      integrationIds: integrations.map((row) => row.integrationId),
    }
  })
}

describe("replaceCheckInSheetWithBadges", () => {
  test("turns an open check-in sheet subtask into Badges ready", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, taskId } = await seedCompetitionWithCheckInSheet(t, {
      status: "in-progress",
    })

    const result = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )

    expect(result).toEqual({ updated: [competitionId], skipped: [] })
    const { task, integrationIds } = await readTask(t, taskId)
    expect(task?.name).toBe("Badges ready")
    expect(task?.templateKey).toBe("badges-ready")
    expect(task?.description).toMatch(/SI Achievements/)
    expect(task?.status).toBe("in-progress")
    expect(integrationIds).toEqual(["wca.achievements-badges"])
  })

  test("matches the subtask by name when it has no template key", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, taskId } = await seedCompetitionWithCheckInSheet(t, {
      withoutTemplateKey: true,
    })

    const result = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )

    expect(result.updated).toEqual([competitionId])
    expect((await readTask(t, taskId)).task?.name).toBe("Badges ready")
  })

  test("leaves a completed subtask alone", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, taskId } = await seedCompetitionWithCheckInSheet(t, {
      status: "done",
    })

    const result = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )

    expect(result).toEqual({
      updated: [],
      skipped: [
        { competitionId, reason: '"Check-in sheet ready" is already done' },
      ],
    })
    const { task, integrationIds } = await readTask(t, taskId)
    expect(task?.name).toBe("Check-in sheet ready")
    expect(integrationIds).toEqual(["sheet.populate-checkin"])
  })

  test("skips completed and cancelled competitions", async () => {
    const t = convexTest(schema, modules)
    const completed = await seedCompetitionWithCheckInSheet(t, {
      startingPhase: "completed",
    })
    const cancelled = await seedCompetitionWithCheckInSheet(t)
    await t.run(async (ctx) => {
      await ctx.db.patch("competitions", cancelled.competitionId, {
        cancelledAt: Date.now(),
      })
    })

    const result = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )

    expect(result).toEqual({
      updated: [],
      skipped: [
        {
          competitionId: completed.competitionId,
          reason: "competition is completed",
        },
        {
          competitionId: cancelled.competitionId,
          reason: "competition is cancelled",
        },
      ],
    })
  })

  test("dry run reports without writing, and re-running is a no-op", async () => {
    const t = convexTest(schema, modules)
    const { competitionId, taskId } = await seedCompetitionWithCheckInSheet(t)

    const dryRun = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      { dryRun: true }
    )
    expect(dryRun.updated).toEqual([competitionId])
    expect((await readTask(t, taskId)).task?.name).toBe("Check-in sheet ready")

    await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )
    const rerun = await t.mutation(
      internal.templates.badgesReadyBackfill.replaceCheckInSheetWithBadges,
      {}
    )
    expect(rerun).toEqual({
      updated: [],
      skipped: [{ competitionId, reason: 'no "Check-in sheet ready" task' }],
    })
  })
})

describe("deleteLegacyCheckInIntegrations", () => {
  test("deletes remaining populate-checkin rows only", async () => {
    const t = convexTest(schema, modules)
    const { taskId } = await seedCompetitionWithCheckInSheet(t, {
      status: "done",
    })
    await t.run(async (ctx) => {
      await ctx.db.insert("taskIntegrations", {
        taskId,
        integrationId: "canva.lanyards",
        status: "idle",
        lastMessage: null,
        lastRunAt: null,
        runId: null,
        output: null,
      })
    })

    expect(
      await t.mutation(
        internal.templates.badgesReadyBackfill.deleteLegacyCheckInIntegrations,
        { dryRun: true }
      )
    ).toEqual({ deleted: 1 })
    expect((await readTask(t, taskId)).integrationIds).toHaveLength(2)

    expect(
      await t.mutation(
        internal.templates.badgesReadyBackfill.deleteLegacyCheckInIntegrations,
        {}
      )
    ).toEqual({ deleted: 1 })
    expect((await readTask(t, taskId)).integrationIds).toEqual([
      "canva.lanyards",
    ])
  })
})
