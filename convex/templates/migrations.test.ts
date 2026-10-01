import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  insertSeedTask,
} from "@/convex/testHelpers"
import { SPONSORSHIP_TASK_TEMPLATE_KEY } from "@/convex/templates/registry"

describe("backfillSponsorshipTaskTemplateKeys", () => {
  test("tags an unambiguous legacy Sponsorship task and skips the rest", async () => {
    const t = convexTest(schema, modules)
    const seeded = await t.run(async (ctx) => {
      const legacyCompetition = await insertBlankCompetition(ctx)
      const legacyPhase = await insertCompetitionPhase(
        ctx,
        legacyCompetition,
        "Pre-Announcement",
        "a0"
      )
      const legacyTask = await insertSeedTask(ctx, {
        name: "Sponsorship",
        parent: { type: "phases", id: legacyPhase },
        order: "a0",
      })
      const otherTask = await insertSeedTask(ctx, {
        name: "Schedule made",
        parent: { type: "phases", id: legacyPhase },
        order: "a1",
      })

      const ambiguousCompetition = await insertBlankCompetition(ctx)
      const ambiguousPhase = await insertCompetitionPhase(
        ctx,
        ambiguousCompetition,
        "Pre-Announcement",
        "a0"
      )
      const ambiguousTasks = [
        await insertSeedTask(ctx, {
          name: "Sponsorship",
          parent: { type: "phases", id: ambiguousPhase },
          order: "a0",
        }),
        await insertSeedTask(ctx, {
          name: "Sponsorship",
          parent: { type: "phases", id: ambiguousPhase },
          order: "a1",
        }),
      ]

      await insertBlankCompetition(ctx)
      return { legacyTask, otherTask, ambiguousTasks }
    })

    const result = await t.mutation(
      internal.templates.migrations.backfillSponsorshipTaskTemplateKeys,
      {}
    )
    expect(result).toMatchObject({ isDone: true, patched: 1 })

    const stored = await t.run(async (ctx) => ({
      legacy: await ctx.db.get("tasks", seeded.legacyTask),
      other: await ctx.db.get("tasks", seeded.otherTask),
      ambiguous: await Promise.all(
        seeded.ambiguousTasks.map((id) => ctx.db.get("tasks", id))
      ),
    }))
    expect(stored.legacy?.templateKey).toBe(SPONSORSHIP_TASK_TEMPLATE_KEY)
    expect(stored.other?.templateKey).toBeUndefined()
    expect(stored.ambiguous.map((task) => task?.templateKey)).toEqual([
      undefined,
      undefined,
    ])

    const rerun = await t.mutation(
      internal.templates.migrations.backfillSponsorshipTaskTemplateKeys,
      {}
    )
    expect(rerun.patched).toBe(0)
  })
})
