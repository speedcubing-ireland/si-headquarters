/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test, vi } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
} from "@/convex/testHelpers"

/** Seeds `count` competitions of template-named phases, with no templateKey. */
async function seedLegacyPhases(
  t: TestConvex<typeof schema>,
  count: number,
  names: readonly string[] = [
    "Concept",
    "Pre-Announcement",
    "Announced",
    "Pre-Competition",
    "Post-Competition",
    "Completed",
  ]
) {
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      const competitionId = await insertBlankCompetition(ctx)
      for (const [position, name] of names.entries()) {
        await insertCompetitionPhase(
          ctx,
          competitionId,
          name,
          `a${String(position)}`
        )
      }
    }
  })
}

async function templateKeyCounts(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const phases = await ctx.db.query("phases").collect()
    return {
      total: phases.length,
      set: phases.filter((phase) => phase.templateKey !== undefined).length,
    }
  })
}

describe("backfillPhaseTemplateKeys", () => {
  test("matches template phases by name", async () => {
    const t = convexTest(schema, modules)
    await seedLegacyPhases(t, 1)

    const result = await t.mutation(
      internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
      {}
    )

    expect(result).toMatchObject({ matched: 6, alreadySet: 0, isDone: true })
    expect(result.unmatched).toEqual([])
    expect(await templateKeyCounts(t)).toEqual({ total: 6, set: 6 })
  })

  test("leaves renamed phases alone and reports them once", async () => {
    const t = convexTest(schema, modules)
    await seedLegacyPhases(t, 2, ["Concept", "Our Own Phase"])

    const result = await t.mutation(
      internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
      {}
    )

    expect(result.matched).toBe(2)
    expect(result.unmatched).toEqual(["Our Own Phase"])
  })

  test("dry run reports without writing", async () => {
    const t = convexTest(schema, modules)
    await seedLegacyPhases(t, 1)

    const result = await t.mutation(
      internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
      { dryRun: true }
    )

    expect(result.matched).toBe(6)
    expect(await templateKeyCounts(t)).toEqual({ total: 6, set: 0 })
  })

  test("skips phases that already have a key", async () => {
    const t = convexTest(schema, modules)
    await seedLegacyPhases(t, 1)

    await t.mutation(internal.phases.wcaBackfill.backfillPhaseTemplateKeys, {})
    const second = await t.mutation(
      internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
      {}
    )

    expect(second).toMatchObject({ matched: 0, alreadySet: 6 })
  })

  test("pages past one batch instead of failing", async () => {
    const t = convexTest(schema, modules)
    // 50 competitions x 6 phases = 300 rows, more than one 200-row page. The
    // previous single-batch version threw at this size, which left templateKey
    // unset and silently reduced the whole sync to a no-op.
    await seedLegacyPhases(t, 50)

    vi.useFakeTimers()
    try {
      await t.mutation(
        internal.phases.wcaBackfill.backfillPhaseTemplateKeys,
        {}
      )
      await t.finishAllScheduledFunctions(() => {
        vi.runAllTimers()
      })
    } finally {
      vi.useRealTimers()
    }

    expect(await templateKeyCounts(t)).toEqual({ total: 300, set: 300 })
  })

  test("rejects an unknown template", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(internal.phases.wcaBackfill.backfillPhaseTemplateKeys, {
        templateKey: "no-such-template",
      })
    ).rejects.toThrow()
  })
})
