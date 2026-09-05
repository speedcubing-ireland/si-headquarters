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
} from "@/convex/testHelpers"
import type { WcaCompetitionStatus } from "@/convex/plugins/wca/validators"

const TEMPLATE_KEY = "standard-competition"
const WCA_ID = "SpringOpen2026"
const NOW = Date.UTC(2026, 5, 15)

/** The template's phases, in order, as the resolver creates them. */
const TEMPLATE_PHASES = [
  { key: "concept", name: "Concept", sortKey: "a0" },
  { key: "pre-announcement", name: "Pre-Announcement", sortKey: "a1" },
  { key: "announced", name: "Announced", sortKey: "a2" },
  { key: "pre-competition", name: "Pre-Competition", sortKey: "a3" },
  { key: "post-competition", name: "Post-Competition", sortKey: "a4" },
  { key: "completed", name: "Completed", sortKey: "a5" },
] as const

type PhaseKey = (typeof TEMPLATE_PHASES)[number]["key"]

function status(
  overrides: Partial<WcaCompetitionStatus> = {}
): WcaCompetitionStatus {
  return {
    wcaCompetitionId: WCA_ID,
    confirmed: false,
    announced: false,
    cancelled: false,
    resultsPosted: false,
    reportPosted: false,
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    registrationCloseAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

async function seedCompetition(
  t: TestConvex<typeof schema>,
  options: {
    startingPhase?: PhaseKey | null
    /** Template phases to omit, to model a competition someone edited. */
    omit?: readonly PhaseKey[]
    linked?: boolean
  } = {}
) {
  return await t.run(async (ctx) => {
    const competitionId = await insertBlankCompetition(ctx)
    if (options.linked !== false) {
      await ctx.db.patch("competitions", competitionId, {
        wcaCompetitionId: WCA_ID,
      })
    }

    const phaseIdByKey = new Map<PhaseKey, Id<"phases">>()
    for (const phase of TEMPLATE_PHASES) {
      if (options.omit?.includes(phase.key) === true) continue
      phaseIdByKey.set(
        phase.key,
        await insertCompetitionPhase(
          ctx,
          competitionId,
          phase.name,
          phase.sortKey,
          "gray",
          phase.key
        )
      )
    }

    const starting = options.startingPhase
    if (starting !== undefined && starting !== null) {
      await ctx.db.patch("competitions", competitionId, {
        phaseId: phaseIdByKey.get(starting) ?? null,
      })
    }

    return { competitionId }
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
  next: WcaCompetitionStatus
) {
  await t.mutation(
    internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
    { status: next, templateKey: TEMPLATE_KEY }
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
