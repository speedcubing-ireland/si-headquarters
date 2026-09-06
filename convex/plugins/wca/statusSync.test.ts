/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  phasesForCompetition,
  seedTaskPerPhase,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"
import { defaultMappings } from "@/convex/phases/wcaMappingModel"
import { unlinkCompetitionIfWcaLinkMatches } from "@/convex/plugins/wca/competitionLink"
import type { WcaCompetitionObservation } from "@/convex/plugins/wca/validators"

const WCA_ID = "SpringOpen2026"
const NOW = Date.UTC(2026, 5, 15)

function status(
  overrides: Partial<WcaCompetitionObservation> = {}
): WcaCompetitionObservation {
  return {
    wcaCompetitionId: WCA_ID,
    confirmed: false,
    announced: false,
    cancelled: false,
    resultsPosted: false,
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    registrationCloseAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

function seedCompetition(
  t: TestConvex<typeof schema>,
  options: {
    startingPhase?: TemplatePhaseKey
    omit?: readonly TemplatePhaseKey[]
    linked?: boolean
  } = {}
) {
  return seedTemplateCompetition(t, {
    startingPhase: options.startingPhase,
    omit: options.omit,
    wcaCompetitionId: options.linked === false ? undefined : WCA_ID,
  })
}

async function currentPhaseKey(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">
): Promise<string | null> {
  return await t.run(async (ctx) => {
    const competition = await ctx.db.get("competitions", competitionId)
    if (competition?.phaseId == null) return null
    const phase = await ctx.db.get("phases", competition.phaseId)
    return phase?.templateKey ?? null
  })
}

async function applyStatus(
  t: TestConvex<typeof schema>,
  next: WcaCompetitionObservation
) {
  await t.mutation(
    internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
    { observation: next, mappings: defaultMappings() }
  )
}

describe("WCA phase sync", () => {
  test("advances a concept competition to Announced once the WCA announces it", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
    })

    await applyStatus(t, status({ confirmed: true, announced: true }))

    expect(await currentPhaseKey(t, competitionId)).toBe("announced")
  })

  test("takes the furthest phase reached, not the first", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
    })

    await applyStatus(
      t,
      status({
        confirmed: true,
        announced: true,
        resultsPosted: true,
        endDate: "2026-06-01",
      })
    )

    expect(await currentPhaseKey(t, competitionId)).toBe("completed")
  })

  test("never moves a competition backwards", async () => {
    const t = convexTest(schema, modules)
    // A human moved this to Pre-Competition early. The WCA only says
    // "announced", which maps to an earlier phase.
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "pre-competition",
    })

    await applyStatus(t, status({ confirmed: true, announced: true }))

    expect(await currentPhaseKey(t, competitionId)).toBe("pre-competition")
  })

  test("advances out of a phase nothing maps to when the next milestone lands", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
    })

    // Concept has no milestone, but `held` unlocks Post-Competition.
    await applyStatus(
      t,
      status({ confirmed: true, announced: true, endDate: "2026-06-01" })
    )

    expect(await currentPhaseKey(t, competitionId)).toBe("post-competition")
  })

  test("skips a milestone whose phase this competition no longer has", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
      omit: ["announced"],
    })

    await applyStatus(t, status({ confirmed: true, announced: true }))

    // Pre-Announcement is the furthest phase that still exists and is unlocked.
    expect(await currentPhaseKey(t, competitionId)).toBe("pre-announcement")
  })

  test("ignores phases that were never created from the template", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await t.run(async (ctx) => {
      const id = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", id, { wcaCompetitionId: WCA_ID })
      // Hand-made phases carry no templateKey, so nothing maps to them.
      await insertCompetitionPhase(ctx, id, "Planning", "a0")
      await insertCompetitionPhase(ctx, id, "Running", "a1")
      return { competitionId: id }
    })

    await applyStatus(t, status({ confirmed: true, announced: true }))

    expect(await currentPhaseKey(t, competitionId)).toBeNull()
  })

  test("stores the status even for a competition we do not have linked", async () => {
    const t = convexTest(schema, modules)
    await seedCompetition(t, { linked: false, startingPhase: "concept" })

    await applyStatus(t, status({ announced: true }))

    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("wcaCompetitionStatuses")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", WCA_ID)
        )
        .unique()
    )
    expect(stored?.announced).toBe(true)
  })

  test("replaces the stored status rather than accumulating rows", async () => {
    const t = convexTest(schema, modules)
    await seedCompetition(t, { startingPhase: "concept" })

    await applyStatus(t, status({ announced: false }))
    await applyStatus(t, status({ announced: true }))

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("wcaCompetitionStatuses")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", WCA_ID)
        )
        .collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].announced).toBe(true)
  })
})

describe("multi-phase jumps", () => {
  /** Backlog task statuses, keyed by the template key of their phase. */
  async function taskStatusByPhaseKey(
    t: TestConvex<typeof schema>,
    competitionId: Id<"competitions">
  ): Promise<Record<string, string>> {
    const phases = await phasesForCompetition(t, competitionId)
    return await t.run(async (ctx) => {
      const byKey: Record<string, string> = {}
      for (const phase of phases) {
        if (phase.templateKey === undefined) continue
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", phase._id)
          )
          .collect()
        if (tasks.length === 0) continue
        byKey[phase.templateKey] = tasks[0].status
      }
      return byKey
    })
  }

  test("activates the backlog of every phase passed through", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
    })

    await seedTaskPerPhase(t, competitionId)

    // Concept -> Post-Competition, skipping three phases.
    await applyStatus(
      t,
      status({ confirmed: true, announced: true, endDate: "2026-06-01" })
    )

    expect(await currentPhaseKey(t, competitionId)).toBe("post-competition")

    const statuses = await taskStatusByPhaseKey(t, competitionId)
    // Every phase entered by the jump, not just the target.
    for (const key of [
      "pre-announcement",
      "announced",
      "pre-competition",
      "post-competition",
    ]) {
      expect(statuses[key]).not.toBe("backlog")
    }
    // Phases beyond the target are untouched.
    expect(statuses.completed).toBe("backlog")
  })

  test("leaves phases before the starting one in backlog", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "announced",
    })

    await seedTaskPerPhase(t, competitionId)

    await applyStatus(
      t,
      status({ confirmed: true, announced: true, endDate: "2026-06-01" })
    )

    const statuses = await taskStatusByPhaseKey(t, competitionId)
    expect(statuses.concept).toBe("backlog")
    expect(statuses["pre-announcement"]).toBe("backlog")
    expect(statuses["post-competition"]).not.toBe("backlog")
  })
})

describe("linked competition scan", () => {
  test("returns only competitions linked to the WCA", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      // Unlinked competitions sort first on the index, so an unranged scan
      // would spend its budget here and might never reach a linked one.
      for (let index = 0; index < 5; index += 1) {
        await insertBlankCompetition(ctx)
      }
      const linked = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", linked, { wcaCompetitionId: WCA_ID })
    })

    const page = await t.query(
      internal.plugins.wca.statusSyncMutations.listLinkedWcaCompetitionIds,
      {}
    )

    expect(page.ids).toEqual([WCA_ID])
    expect(page.isDone).toBe(true)
  })

  test("pages rather than failing once there are many competitions", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      for (let index = 0; index < 250; index += 1) {
        const id = await insertBlankCompetition(ctx)
        await ctx.db.patch("competitions", id, {
          wcaCompetitionId: `Comp${String(index).padStart(4, "0")}`,
        })
      }
    })

    const ids: string[] = []
    let cursor: string | null = null
    for (;;) {
      const page: { ids: string[]; cursor: string | null; isDone: boolean } =
        await t.query(
          internal.plugins.wca.statusSyncMutations.listLinkedWcaCompetitionIds,
          { cursor }
        )
      ids.push(...page.ids)
      if (page.isDone) break
      cursor = page.cursor
    }

    expect(ids).toHaveLength(250)
    expect(new Set(ids).size).toBe(250)
  })
})

describe("cancellation", () => {
  test("flags the competition without touching its phase", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "announced",
    })

    await applyStatus(
      t,
      status({ confirmed: true, announced: true, cancelled: true })
    )

    const competition = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.cancelledAt).toBe(NOW)
    expect(await currentPhaseKey(t, competitionId)).toBe("announced")
  })

  test("clears the flag when the WCA reinstates the competition", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "announced",
    })

    await applyStatus(t, status({ announced: true, cancelled: true }))
    await applyStatus(t, status({ announced: true, cancelled: false }))

    const competition = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.cancelledAt).toBeUndefined()
  })

  test("keeps the flag when this run could not determine cancellation", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "announced",
    })

    await applyStatus(t, status({ announced: true, cancelled: true }))
    // A run that saw the competition only in the country index, which carries
    // no cancellation field. It must not read as a reinstatement.
    await applyStatus(t, status({ announced: true, cancelled: null }))

    const competition = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.cancelledAt).toBe(NOW)
  })

  test("keeps a known registration close date across a run without the index", async () => {
    const t = convexTest(schema, modules)
    await seedCompetition(t, { startingPhase: "announced" })
    const closeAt = Date.UTC(2026, 10, 1)

    await applyStatus(
      t,
      status({ announced: true, registrationCloseAt: closeAt })
    )
    await applyStatus(t, status({ announced: true, registrationCloseAt: null }))

    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("wcaCompetitionStatuses")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", WCA_ID)
        )
        .unique()
    )
    expect(stored?.registrationCloseAt).toBe(closeAt)
  })

  test("unlinking clears the flag so the competition is not stranded", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "announced",
    })

    await applyStatus(t, status({ announced: true, cancelled: true }))
    await t.run(async (ctx) =>
      unlinkCompetitionIfWcaLinkMatches(ctx, competitionId, WCA_ID)
    )

    const competition = await t.run(async (ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.wcaCompetitionId).toBeUndefined()
    expect(competition?.cancelledAt).toBeUndefined()
  })

  test("does not block the phase from advancing", async () => {
    const t = convexTest(schema, modules)
    const { competitionId } = await seedCompetition(t, {
      startingPhase: "concept",
    })

    await applyStatus(
      t,
      status({ confirmed: true, announced: true, cancelled: true })
    )

    expect(await currentPhaseKey(t, competitionId)).toBe("announced")
  })
})
