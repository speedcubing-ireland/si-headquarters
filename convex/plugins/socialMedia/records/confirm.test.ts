/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  confirmRecord,
  toPostedRecords,
} from "@/convex/plugins/socialMedia/records/confirm"
import {
  wcaCompetition,
  wcaRecord,
  wcaResponder,
  wcaResult,
} from "@/convex/plugins/socialMedia/records/testFixtures"
import type {
  WcaCompetition,
  WcaResult,
} from "@/convex/plugins/socialMedia/records/wcaResults"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

// Monday 26 Oct 2026: the fixture's Dublin Open ended the day before.
const NOW = Date.UTC(2026, 9, 26, 6, 30)

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

  /**
   * Answers the WCA as if only `posted` competitions have their results up,
   * found by looking each up rather than in the WCA's listing, which has only
   * `listed`.
   */
  function stubWca(
    posted: Record<string, WcaResult[]>,
    failing: string[] = [],
    listed: WcaCompetition[] = []
  ) {
    const respond = wcaResponder({
      competitions: [
        ...listed,
        ...Object.keys(posted).map((id) => wcaCompetition({ id, name: id })),
      ],
      listed,
      results: posted,
      failing,
    })
    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => respond(input))
  }

  async function rows(t: TestConvex<typeof schema>) {
    return await t.run(
      async (ctx) => await ctx.db.query("wcaRecords").collect()
    )
  }

  /** The WCA URLs fetched, but for the competition listing. */
  function lookups(fetchSpy: ReturnType<typeof stubWca>): string[] {
    return fetchSpy.mock.calls
      .map(([input]) => requestUrl(input))
      .filter((url) => !url.includes("/competitions?"))
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
    const firstRound = wcaResult({
      id: 4000,
      round_id: 10,
      round_type_id: "1",
      regional_single_record: null,
    })
    const fetchSpy = stubWca(
      {
        Posted2026: [firstRound, wcaResult()],
        Dropped2026: [firstRound, wcaResult({ regional_single_record: null })],
      },
      ["Failing2026"]
    )

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    // The confirmed record is not added again from the posted results.
    expect(await rows(t)).toHaveLength(5)
    expect(await statuses(t)).toEqual({
      Posted2026: ["confirmed", 987],
      Dropped2026: ["notRecord", 987],
      Unposted2026: ["live", 987],
      Failing2026: ["live", 987],
      Ongoing2026: ["live", 987],
    })
    // Only a confirmed record is timed, for the next weekly email to pick up.
    const confirmedAt = Object.fromEntries(
      (await rows(t)).map((row) => [
        row.wcaCompetitionId,
        typeof row.confirmedAt,
      ])
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

  test("adds the records of a posted competition WCA Live never had, once", async () => {
    const t = convexTest(schema, modules)
    const thurles = wcaCompetition({
      id: "Thurles2026",
      name: "Thurles 2026",
      start_date: "2026-10-24",
      end_date: "2026-10-25",
    })
    const fetchSpy = stubWca(
      {
        Thurles2026: [
          wcaResult({ id: 7, event_id: "333bf", best: 2154 }),
          wcaResult({
            id: 8,
            name: "Someone Else",
            wca_id: "2020ELSE01",
            regional_single_record: null,
          }),
        ],
      },
      [],
      [thurles]
    )

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})
    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(await rows(t)).toEqual([
      expect.objectContaining({
        liveRecordId: "wca:7:single",
        status: "confirmed",
        tag: "NR",
        eventId: "333bf",
        attemptResult: 2154,
        wcaId: "2015MURP01",
        liveCompetitionId: null,
        wcaCompetitionId: "Thurles2026",
        competitionEndDate: "2026-10-25",
        confirmedAt: NOW,
      }),
    ])
    // The second run found the competition already read.
    expect(lookups(fetchSpy)).toEqual([
      "https://www.worldcubeassociation.org/api/v0/competitions/Thurles2026/results",
    ])
  })

  test("reads a competition again once the WCA posts its results anew", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert("wcaRecordScans", {
        wcaCompetitionId: "DublinOpen2026",
        resultsPostedAt: "2026-10-25T20:00:00.000Z",
        competitionEndDate: "2026-10-25",
        scannedAt: 0,
      })
    })
    stubWca({ DublinOpen2026: [wcaResult()] }, [], [wcaCompetition()])

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(await rows(t)).toHaveLength(1)
    const scans = await t.run(
      async (ctx) => await ctx.db.query("wcaRecordScans").collect()
    )
    expect(scans).toEqual([
      expect.objectContaining({
        resultsPostedAt: "2026-10-26T00:00:00.000Z",
        scannedAt: NOW,
      }),
    ])
  })

  test("does not add a record already imported from the WCA's history", async () => {
    const t = convexTest(schema, modules)
    await insert(t, [
      wcaRecord({
        liveRecordId: "wca:5000:single",
        status: "confirmed",
        liveCompetitionId: null,
        // The history only had the start date, and no real round number.
        competitionEndDate: "2026-10-24",
        roundNumber: 5,
      }),
    ])
    stubWca({ DublinOpen2026: [wcaResult()] }, [], [wcaCompetition()])

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    const [row, ...others] = await rows(t)
    expect(others).toEqual([])
    expect(row.roundNumber).toBe(5)
    expect(row.confirmedAt).toBeUndefined()
  })

  test("forgets competitions that ended before the scan's window", async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      for (const [id, endDate] of [
        ["Old2026", "2026-08-01"],
        ["Recent2026", "2026-10-11"],
      ]) {
        await ctx.db.insert("wcaRecordScans", {
          wcaCompetitionId: id,
          resultsPostedAt: "2026-08-02T00:00:00.000Z",
          competitionEndDate: endDate,
          scannedAt: 0,
        })
      }
    })
    stubWca({})

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    const scans = await t.run(
      async (ctx) => await ctx.db.query("wcaRecordScans").collect()
    )
    expect(scans.map((scan) => scan.wcaCompetitionId)).toEqual(["Recent2026"])
  })

  test("reads the country's competitions first when more are posted than a run reads", async () => {
    const t = convexTest(schema, modules)
    const abroad = Array.from({ length: 45 }, (_, index) =>
      wcaCompetition({
        id: `Abroad${String(index)}`,
        country_iso2: "FR",
        end_date: "2026-10-25",
      })
    )
    const home = wcaCompetition({ id: "Home2026", end_date: "2026-10-04" })
    const fetchSpy = stubWca({ Home2026: [wcaResult()] }, [], [...abroad, home])

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(lookups(fetchSpy)).toHaveLength(40)
    expect(lookups(fetchSpy)).toContain(
      "https://www.worldcubeassociation.org/api/v0/competitions/Home2026/results"
    )
    expect((await rows(t)).map((row) => row.wcaCompetitionId)).toEqual([
      "Home2026",
    ])
  })

  test("never looks again at records already settled", async () => {
    const t = convexTest(schema, modules)
    await insert(t, [wcaRecord({ status: "confirmed" })])
    const fetchSpy = stubWca({})

    await t.action(internal.plugins.socialMedia.records.confirm.confirm, {})

    expect(lookups(fetchSpy)).toEqual([])
  })
})

describe("toPostedRecords", () => {
  const abroad = wcaCompetition({ id: "Paris2026", country_iso2: "FR" })

  test("keeps the records of competitors from the country, wherever they compete", () => {
    expect(
      toPostedRecords(
        [
          wcaResult({ id: 1 }),
          wcaResult({ id: 2, country_iso2: "FR", name: "Jean Dupont" }),
        ],
        abroad,
        "IE"
      ).map((record) => record.liveRecordId)
    ).toEqual(["wca:1:single"])
  })

  test("keeps every record set at a competition held in the country", () => {
    expect(
      toPostedRecords(
        [
          wcaResult({
            id: 2,
            country_iso2: "FR",
            regional_single_record: "WR",
            regional_average_record: "ER",
          }),
        ],
        wcaCompetition(),
        "IE"
      )
    ).toEqual([
      expect.objectContaining({
        liveRecordId: "wca:2:single",
        tag: "WR",
        attemptResult: 987,
        personCountryIso2: "FR",
      }),
      expect.objectContaining({
        liveRecordId: "wca:2:average",
        tag: "CR",
        type: "average",
        attemptResult: 1123,
      }),
    ])
  })

  test("numbers and names rounds as WCA Live does, matching confirmRecord", () => {
    const results = [
      wcaResult({
        id: 1,
        round_id: 12,
        round_type_id: "1",
        regional_single_record: null,
      }),
      wcaResult({ id: 2, round_id: 31, round_type_id: "c" }),
      wcaResult({ id: 3, round_id: 5, event_id: "222", round_type_id: "f" }),
    ]
    const records = toPostedRecords(results, wcaCompetition(), "IE")

    expect(
      records.map(({ eventId, roundName, roundNumber }) => [
        eventId,
        roundName,
        roundNumber,
      ])
    ).toEqual([
      ["333", "Final", 2],
      ["222", "Final", 1],
    ])
    expect(confirmRecord({ ...records[0], status: "live" }, results)).toEqual(
      expect.objectContaining({ status: "confirmed" })
    )
  })

  test("refuses a round type it does not know", () => {
    expect(() =>
      toPostedRecords(
        [wcaResult({ round_type_id: "z" })],
        wcaCompetition(),
        "IE"
      )
    ).toThrow('Unknown round type "z" for result 5000.')
  })
})
