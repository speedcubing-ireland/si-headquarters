/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertCompetitionPhase,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import type { WcaCompetitionObservation } from "@/convex/plugins/wca/validators"

const WCA_ID = "SpringOpen2026"
const NOW = Date.UTC(2026, 5, 15)

const TEMPLATE_PHASES = [
  { key: "concept", name: "Concept" },
  { key: "pre-announcement", name: "Pre-Announcement" },
  { key: "announced", name: "Announced" },
  { key: "pre-competition", name: "Pre-Competition" },
  { key: "post-competition", name: "Post-Competition" },
  { key: "completed", name: "Completed" },
] as const

function observation(
  overrides: Partial<WcaCompetitionObservation> = {}
): WcaCompetitionObservation {
  return {
    wcaCompetitionId: WCA_ID,
    confirmed: true,
    cancelled: false,
    announced: true,
    resultsPosted: false,
    reportPosted: false,
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    registrationCloseAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

async function seedLinkedCompetition(
  t: TestConvex<typeof schema>,
  omit: readonly string[] = []
): Promise<Id<"competitions">> {
  return await t.run(async (ctx) => {
    const competitionId = await insertBlankCompetition(ctx)
    await ctx.db.patch("competitions", competitionId, {
      wcaCompetitionId: WCA_ID,
    })
    for (const [index, phase] of TEMPLATE_PHASES.entries()) {
      if (omit.includes(phase.key)) continue
      await insertCompetitionPhase(
        ctx,
        competitionId,
        phase.name,
        `a${String(index)}`,
        "gray",
        phase.key
      )
    }
    return competitionId
  })
}

describe("getForCompetition", () => {
  test("returns null for a competition with no WCA link", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await t.run(async (ctx) =>
      insertBlankCompetition(ctx)
    )

    expect(
      await client.query(api.plugins.wca.statusQueries.getForCompetition, {
        competitionId,
      })
    ).toBeNull()
  })

  test("reports the milestones reached, furthest last", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      { observation: observation(), templateKey: "standard-competition" }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status?.reached).toEqual(["submitted", "confirmed", "announced"])
  })

  test("stays quiet about a milestone that is deliberately unmapped", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      { observation: observation(), templateKey: "standard-competition" }
    )

    // The template maps nothing to `confirmed`, which is a choice rather than a
    // problem — reporting it would put a permanent warning on every competition.
    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status?.unmapped).toEqual([])
  })

  test("reports a milestone whose mapped phase this competition lacks", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t, ["announced"])

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      { observation: observation(), templateKey: "standard-competition" }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status?.unmapped).toEqual(["announced"])
  })

  test("reports cancellation and the last sync time", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      {
        observation: observation({ cancelled: true }),
        templateKey: "standard-competition",
      }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status).toMatchObject({ cancelled: true, fetchedAt: NOW })
  })
})
