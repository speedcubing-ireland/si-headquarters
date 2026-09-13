/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertSeedTask,
  phasesForCompetition,
  seedTemplateCompetition,
  withVolunteerTestClient,
  type TemplatePhaseKey,
} from "@/convex/testHelpers"
import { defaultMappings } from "@/convex/phases/wcaMappingModel"
import type { WcaCompetitionObservation } from "@/convex/plugins/wca/validators"

const WCA_ID = "SpringOpen2026"
const NOW = Date.UTC(2026, 5, 15)

function observation(
  overrides: Partial<WcaCompetitionObservation> = {}
): WcaCompetitionObservation {
  return {
    wcaCompetitionId: WCA_ID,
    confirmed: true,
    cancelled: false,
    announced: true,
    resultsPosted: false,
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    registrationCloseAt: null,
    refundDeadlineAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

async function seedLinkedCompetition(
  t: TestConvex<typeof schema>,
  omit: readonly TemplatePhaseKey[] = []
): Promise<Id<"competitions">> {
  const { competitionId } = await seedTemplateCompetition(t, {
    omit,
    wcaCompetitionId: WCA_ID,
  })
  return competitionId
}

/** One outstanding task in the competition's Concept phase. */
async function seedOutstandingConceptTask(
  t: TestConvex<typeof schema>,
  competitionId: Id<"competitions">
): Promise<void> {
  const phases = await phasesForCompetition(t, competitionId)
  const concept = phases.find((phase) => phase.templateKey === "concept")
  if (concept === undefined) throw new Error("No concept phase seeded")

  await t.run(async (ctx) => {
    await insertSeedTask(ctx, {
      parent: { type: "phases", id: concept._id },
      order: "a0",
      status: "to-do",
    })
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
      { observation: observation(), mappings: defaultMappings() }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    // The seeded Concept phase has no tasks, so the concept gate is open.
    expect(status?.reached).toEqual([
      "submitted",
      "conceptTasksComplete",
      "confirmed",
      "announced",
    ])
  })

  test("leaves out the concept milestone while a Concept task is open", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)
    await seedOutstandingConceptTask(t, competitionId)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      { observation: observation(), mappings: defaultMappings() }
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
      { observation: observation(), mappings: defaultMappings() }
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
      { observation: observation(), mappings: defaultMappings() }
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
        mappings: defaultMappings(),
      }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status).toMatchObject({ cancelled: true, fetchedAt: NOW })
  })
})

describe("getForCompetition — refund deadline", () => {
  test("reports the milestone in ladder order between close and held", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      {
        observation: observation({
          endDate: "2026-06-01",
          registrationCloseAt: Date.UTC(2026, 4, 20),
          refundDeadlineAt: Date.UTC(2026, 4, 25),
        }),
        mappings: defaultMappings(),
      }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status?.reached).toEqual([
      "submitted",
      "conceptTasksComplete",
      "confirmed",
      "announced",
      "registrationClosed",
      "refundDeadlinePassed",
      "held",
    ])
  })

  test("registration close alone shows without the refund milestone", async () => {
    const t = convexTest(schema, modules)
    const { client } = await withVolunteerTestClient(t)
    const competitionId = await seedLinkedCompetition(t)

    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      {
        observation: observation({
          registrationCloseAt: Date.UTC(2026, 4, 20),
          refundDeadlineAt: null,
        }),
        mappings: defaultMappings(),
      }
    )

    const status = await client.query(
      api.plugins.wca.statusQueries.getForCompetition,
      { competitionId }
    )
    expect(status?.reached).toContain("registrationClosed")
    expect(status?.reached).not.toContain("refundDeadlinePassed")
    // `registrationClosed` is unmapped by default, which is a choice rather
    // than a problem — same reasoning as `confirmed`.
    expect(status?.unmapped).toEqual([])
  })
})
