/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { resolveWcaPhaseAdvance } from "@/convex/phases/wcaAdvance"
import type { WcaMilestone } from "@/convex/phases/wcaMilestones"
import { defaultMappings } from "@/convex/phases/wcaMappingModel"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  phasesForCompetition,
  seedTemplateCompetition,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"

/**
 * Real phase rows rather than hand-built docs, so `sortKey` ordering is the
 * template's own and the assertions mean what they say.
 */
async function advanceFrom(options: {
  currentPhase: TemplatePhaseKey
  reached: readonly WcaMilestone[]
  blocked: readonly TemplatePhaseKey[]
}) {
  const t = convexTest(schema, modules)
  const { competitionId } = await seedTemplateCompetition(t, {
    startingPhase: options.currentPhase,
  })
  const phases = await phasesForCompetition(t, competitionId)
  const idOf = (key: TemplatePhaseKey) => {
    const phase = phases.find((candidate) => candidate.templateKey === key)
    if (phase === undefined) throw new Error(`No ${key} phase seeded`)
    return phase._id
  }

  const nextPhaseId = resolveWcaPhaseAdvance({
    phases,
    currentPhaseId: idOf(options.currentPhase),
    mappings: defaultMappings(),
    reached: new Set(options.reached),
    blockedPhaseIds: new Set(options.blocked.map(idOf)),
  })

  return phases.find((phase) => phase._id === nextPhaseId)?.templateKey ?? null
}

describe("resolveWcaPhaseAdvance — blocked phases", () => {
  test("a blocked phase is not advanced into", async () => {
    expect(
      await advanceFrom({
        currentPhase: "concept",
        reached: ["submitted"],
        blocked: ["pre-announcement"],
      })
    ).toBeNull()
  })

  test("a further unlocked phase is still taken past a blocked one", async () => {
    // The escape hatch: blocking removes one candidate, it does not hold back
    // the phases after it.
    expect(
      await advanceFrom({
        currentPhase: "concept",
        reached: ["submitted", "announced"],
        blocked: ["pre-announcement"],
      })
    ).toBe("announced")
  })

  test("an unblocked phase advances as before", async () => {
    expect(
      await advanceFrom({
        currentPhase: "concept",
        reached: ["submitted"],
        blocked: [],
      })
    ).toBe("pre-announcement")
  })
})
