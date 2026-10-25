/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  insertBlankCompetition,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"
import {
  recentRecord,
  wcaRecord,
} from "@/convex/plugins/socialMedia/records/testFixtures"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

const HOUR = 60 * 60_000
// Monday 26 Oct 2026: the feed reaches back to competitions starting on the
// 16th, and a withdrawn record is only trusted from the 17th.
const NOW = Date.UTC(2026, 9, 26, 9)

afterEach(() => {
  vi.restoreAllMocks()
})

async function saveSync(
  t: TestConvex<typeof schema>,
  records: WcaRecord[],
  syncedAt = NOW
) {
  await t.mutation(internal.plugins.socialMedia.records.store.saveSync, {
    records,
    syncedAt,
  })
}

async function storedRows(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => await ctx.db.query("wcaRecords").collect())
}

describe("saveSync", () => {
  test("updates a record seen again instead of duplicating it", async () => {
    const t = convexTest(schema, modules)
    const record = wcaRecord()

    const corrected = { ...record, attemptResult: 912 }

    await saveSync(t, [record], NOW - HOUR)
    await saveSync(t, [corrected, wcaRecord({ eventId: "222" })], NOW)

    const rows = await storedRows(t)
    expect(rows).toHaveLength(2)
    expect(
      rows.find((row) => row.liveRecordId === record.liveRecordId)
    ).toMatchObject(corrected)
  })

  test("deletes a record WCA Live dropped while its competition is still in the feed", async () => {
    const t = convexTest(schema, modules)
    const kept = wcaRecord({ eventId: "222" })
    const withdrawn = wcaRecord({ eventId: "333" })

    await saveSync(t, [kept, withdrawn], NOW - HOUR)
    await saveSync(t, [kept], NOW)

    expect((await storedRows(t)).map((row) => row.liveRecordId)).toEqual([
      kept.liveRecordId,
    ])
  })

  test("keeps records whose competition has aged out of the feed", async () => {
    const t = convexTest(schema, modules)
    const agedOut = wcaRecord({
      competitionStartDate: "2026-10-16",
      competitionEndDate: "2026-10-18",
    })

    await saveSync(t, [agedOut], NOW - 24 * HOUR)
    await saveSync(t, [], NOW)

    expect(await storedRows(t)).toHaveLength(1)
  })
})

describe("sync", () => {
  test("stores the organisation's records from WCA Live's feed", async () => {
    const t = convexTest(schema, modules)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          recentRecords: [
            recentRecord({ personName: "Home" }),
            recentRecord({ personName: "Elsewhere", personCountryIso2: "FR" }, [
              "FR",
            ]),
          ],
        },
      })
    )

    await t.action(internal.plugins.socialMedia.records.store.sync, {})

    expect((await storedRows(t)).map((row) => row.personName)).toEqual(["Home"])
  })
})

describe("forWeek", () => {
  test("returns the week's records by the organisation's competitors", async () => {
    const t = convexTest(schema, modules)
    await saveSync(t, [
      wcaRecord({ personName: "Monday", competitionEndDate: "2026-10-19" }),
      wcaRecord({ personName: "Sunday", competitionEndDate: "2026-10-25" }),
      wcaRecord({ personName: "Before", competitionEndDate: "2026-10-18" }),
      wcaRecord({ personName: "After", competitionEndDate: "2026-10-26" }),
      wcaRecord({ personName: "Visitor", personCountryIso2: "GB" }),
    ])

    const rows = await t.query(
      internal.plugins.socialMedia.records.store.forWeek,
      { weekStart: "2026-10-19" }
    )

    expect(rows.map((row) => row.personName).sort()).toEqual([
      "Monday",
      "Sunday",
    ])
  })
})

describe("list", () => {
  test("groups records by competition, latest first, linked to HQ", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await t.run(async (ctx) => {
      const id = await insertBlankCompetition(ctx)
      await ctx.db.patch("competitions", id, {
        wcaCompetitionId: "DublinOpen2026",
      })
      return id
    })
    await saveSync(t, [
      wcaRecord(),
      wcaRecord({
        liveCompetitionId: "202",
        wcaCompetitionId: "CorkOpen2026",
        competitionName: "Cork Open 2026",
        competitionEndDate: "2026-10-18",
      }),
      wcaRecord({
        liveCompetitionId: "303",
        competitionName: "Too Old 2026",
        competitionEndDate: "2026-09-01",
      }),
    ])
    const { client } = await withVolunteerTestClient(t)

    const competitions = await client.query(
      api.plugins.socialMedia.records.queries.list,
      { since: "2026-10-01" }
    )

    expect(
      competitions.map((competition) => [
        competition.competitionName,
        competition.hqCompetitionId,
      ])
    ).toEqual([
      ["Dublin Open 2026", competitionId],
      ["Cork Open 2026", null],
    ])
  })

  test("lists competitions ending the same day in name order", async () => {
    const t = convexTest(schema, modules)
    await saveSync(t, [
      wcaRecord({ liveCompetitionId: "303", competitionName: "Galway Open" }),
      wcaRecord({ liveCompetitionId: "101", competitionName: "Cork Open" }),
      wcaRecord({
        liveCompetitionId: "202",
        competitionName: "Athlone Open",
        competitionEndDate: "2026-10-18",
      }),
    ])
    const { client } = await withVolunteerTestClient(t)

    const competitions = await client.query(
      api.plugins.socialMedia.records.queries.list,
      { since: "2026-10-01" }
    )

    expect(
      competitions.map((competition) => competition.competitionName)
    ).toEqual(["Cork Open", "Galway Open", "Athlone Open"])
  })

  test("refuses users without Social Media Dashboard access", async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => insertTestUser(ctx, "Outsider"))

    await expect(
      t
        .withIdentity({ subject: userId })
        .query(api.plugins.socialMedia.records.queries.list, {
          since: "2026-10-01",
        })
    ).rejects.toThrow()
  })
})
