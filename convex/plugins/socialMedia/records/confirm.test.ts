/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  confirmRecord,
  type WcaResult,
} from "@/convex/plugins/socialMedia/records/confirm"
import { wcaRecord } from "@/convex/plugins/socialMedia/records/testFixtures"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

// Monday 26 Oct 2026: the fixture's Dublin Open ended the day before.
const NOW = Date.UTC(2026, 9, 26, 6, 30)

/** The fixture record's result as the WCA posts it: round 2 of 3x3x3. */
function wcaResult(overrides: Partial<WcaResult> = {}): WcaResult {
  return {
    round_id: 20,
    event_id: "333",
    name: "Aoife Murphy",
    wca_id: "2015MURP01",
    country_iso2: "IE",
    best: 987,
    average: 1123,
    regional_single_record: "NR",
    regional_average_record: null,
    ...overrides,
  }
}

describe("confirmRecord", () => {
  test("confirms a record the WCA still marks, with the WCA's values", () => {
    expect(
      confirmRecord(wcaRecord({ attemptResult: 990 }), [
        wcaResult({ round_id: 10, regional_single_record: null }),
        wcaResult(),
      ])
    ).toEqual({
      status: "confirmed",
      tag: "NR",
      attemptResult: 987,
      wcaId: "2015MURP01",
      personName: "Aoife Murphy",
    })
  })

  test("reads a continental marker as a CR", () => {
    expect(
      confirmRecord(wcaRecord({ type: "average", tag: "NR" }), [
        wcaResult({ round_id: 10 }),
        wcaResult({ regional_average_record: "ER" }),
      ])
    ).toMatchObject({ status: "confirmed", tag: "CR", attemptResult: 1123 })
  })

  test("drops a record the WCA no longer marks", () => {
    expect(
      confirmRecord(wcaRecord(), [
        wcaResult({ round_id: 10 }),
        wcaResult({ regional_single_record: null }),
      ])
    ).toEqual({ status: "notRecord" })
  })

  test("drops a record whose result the WCA does not have", () => {
    expect(confirmRecord(wcaRecord(), [wcaResult({ round_id: 10 })])).toEqual({
      status: "notRecord",
    })
  })

  test("finds a newcomer by name and country, and takes their new WCA ID", () => {
    const newcomer: Partial<WcaRecord> = {
      wcaId: null,
      personName: "Seán Kelly",
      roundNumber: 1,
    }
    expect(
      confirmRecord(wcaRecord(newcomer), [
        wcaResult({
          name: "Seán Kelly",
          wca_id: "2026KELL01",
          country_iso2: "GB",
        }),
        wcaResult({ name: "Seán Kelly", wca_id: "2026KELL02" }),
      ])
    ).toMatchObject({ status: "confirmed", wcaId: "2026KELL02" })
  })

  test("numbers an event's rounds by their WCA round ids", () => {
    const results = [
      wcaResult({ round_id: 31, regional_single_record: "WR" }),
      wcaResult({ round_id: 12, regional_single_record: null }),
      wcaResult({ round_id: 20, event_id: "222", name: "Other" }),
    ]

    expect(confirmRecord(wcaRecord({ roundNumber: 2 }), results)).toMatchObject(
      { status: "confirmed", tag: "WR" }
    )
    expect(confirmRecord(wcaRecord({ roundNumber: 1 }), results)).toEqual({
      status: "notRecord",
    })
  })
})

describe("confirm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function insert(t: TestConvex<typeof schema>, records: WcaRecord[]) {
    await t.run(async (ctx) => {
      for (const record of records) await ctx.db.insert("wcaRecords", record)
    })
  }

  async function statuses(t: TestConvex<typeof schema>) {
    const rows = await t.run(
      async (ctx) => await ctx.db.query("wcaRecords").collect()
    )
    return Object.fromEntries(
      rows.map((row) => [row.wcaCompetitionId, [row.status, row.attemptResult]])
    )
  }

  function requestUrl(input: Parameters<typeof fetch>[0]): string {
    return input instanceof Request ? input.url : input.toString()
  }

  /** Answers the WCA as if only `posted` competitions have their results up. */
  function stubWca(
    posted: Record<string, WcaResult[]>,
    failing: string[] = []
  ) {
    const competitionUrl = (id: string) =>
      `https://www.worldcubeassociation.org/api/v0/competitions/${id}`
    const responses = new Map<string, unknown>()
    for (const [id, results] of Object.entries(posted)) {
      responses.set(competitionUrl(id), {
        results_posted_at: "2026-10-26T00:00:00.000Z",
      })
      responses.set(`${competitionUrl(id)}/results`, results)
    }
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input)
      if (failing.some((id) => url.startsWith(competitionUrl(id)))) {
        return Response.json({ error: "unavailable" }, { status: 503 })
      }
      return Response.json(responses.get(url) ?? { results_posted_at: null })
    })
  }

  test("settles the records of competitions the WCA has posted", async () => {
    const t = convexTest(schema, modules)
    await insert(t, [
      wcaRecord({ wcaCompetitionId: "Posted2026", attemptResult: 990 }),
      wcaRecord({ wcaCompetitionId: "Dropped2026" }),
      wcaRecord({ wcaCompetitionId: "Unposted2026" }),
      wcaRecord({ wcaCompetitionId: "Failing2026" }),
      wcaRecord({
        wcaCompetitionId: "Ongoing2026",
        competitionStartDate: "2026-10-26",
        competitionEndDate: "2026-10-26",
      }),
    ])
    const fetchSpy = stubWca(
      {
        Posted2026: [wcaResult({ round_id: 10 }), wcaResult()],
        Dropped2026: [
          wcaResult({ round_id: 10 }),
          wcaResult({ regional_single_record: null }),
        ],
      },
      ["Failing2026"]
    )

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(await statuses(t)).toEqual({
      Posted2026: ["confirmed", 987],
      Dropped2026: ["notRecord", 987],
      Unposted2026: ["live", 987],
      Failing2026: ["live", 987],
      Ongoing2026: ["live", 987],
    })
    // Only a confirmed record is timed, for the next weekly email to pick up.
    const confirmedAt = Object.fromEntries(
      (
        await t.run(async (ctx) => await ctx.db.query("wcaRecords").collect())
      ).map((row) => [row.wcaCompetitionId, typeof row.confirmedAt])
    )
    expect(confirmedAt).toEqual({
      Posted2026: "number",
      Dropped2026: "undefined",
      Unposted2026: "undefined",
      Failing2026: "undefined",
      Ongoing2026: "undefined",
    })
    // A competition still under way is not looked up at all.
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        requestUrl(input).includes("Ongoing2026")
      )
    ).toBe(false)
  })

  test("never looks again at records already settled", async () => {
    const t = convexTest(schema, modules)
    await insert(t, [wcaRecord({ status: "confirmed" })])
    const fetchSpy = stubWca({})

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
