import { afterEach, describe, expect, test, vi } from "vitest"
import {
  fetchRecentRecords,
  groupByCompetition,
  toStoredRecords,
} from "@/convex/plugins/socialMedia/records/collect"
import {
  recentRecord,
  wcaRecord,
} from "@/convex/plugins/socialMedia/records/testFixtures"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("toStoredRecords", () => {
  test("keeps records by the country's competitors or at its competitions", () => {
    const feed = [
      recentRecord({ personName: "Home", personCountryIso2: "IE" }),
      recentRecord({ personName: "Visitor", personCountryIso2: "GB" }, [
        "FR",
        "IE",
      ]),
      recentRecord({ personName: "Abroad", personCountryIso2: "IE" }, ["FR"]),
      recentRecord({ personName: "Elsewhere", personCountryIso2: "GB" }, [
        "FR",
      ]),
    ]

    expect(
      toStoredRecords(feed, "IE").map((record) => record.personName)
    ).toEqual(["Home", "Visitor", "Abroad"])
  })

  test("maps WCA Live's record to the stored shape", () => {
    const record = wcaRecord({ wcaId: null, tag: "CR" })

    expect(toStoredRecords([recentRecord(record)], "IE")).toEqual([record])
  })
})

describe("groupByCompetition", () => {
  test("orders competitions by end date then name, records by event, round and type", () => {
    const grouped = groupByCompetition([
      wcaRecord({ eventId: "333", roundNumber: 2, type: "average" }),
      wcaRecord({ eventId: "333", roundName: "First Round", roundNumber: 1 }),
      wcaRecord({ eventId: "222", tag: "WR" }),
      wcaRecord({ eventId: "333", roundNumber: 2 }),
      wcaRecord({
        competitionName: "Cork Open 2026",
        liveCompetitionId: "202",
      }),
      wcaRecord({
        competitionName: "Galway Open 2026",
        liveCompetitionId: "303",
        competitionEndDate: "2026-10-19",
      }),
    ])

    expect(
      grouped.map((competition) => [
        competition.competitionName,
        competition.records.map(
          (record) =>
            `${record.tag} ${record.eventId} ${record.roundName} ${record.type}`
        ),
      ])
    ).toEqual([
      ["Galway Open 2026", ["NR 333 Final single"]],
      ["Cork Open 2026", ["NR 333 Final single"]],
      [
        "Dublin Open 2026",
        [
          "WR 222 Final single",
          "NR 333 First Round single",
          "NR 333 Final single",
          "NR 333 Final average",
        ],
      ],
    ])
  })

  test("counts a competition's results as posted once no record is live", () => {
    const grouped = groupByCompetition([
      wcaRecord({ status: "confirmed" }),
      wcaRecord({ status: "notRecord", eventId: "222" }),
      wcaRecord({ liveCompetitionId: "202", status: "confirmed" }),
      wcaRecord({ liveCompetitionId: "202", eventId: "222" }),
    ])

    expect(
      grouped.map((competition) => [
        competition.liveCompetitionId,
        competition.resultsPosted,
      ])
    ).toEqual([
      ["101", true],
      ["202", false],
    ])
  })
})

describe("fetchRecentRecords", () => {
  test("asks WCA Live for its recent records", async () => {
    const record = recentRecord()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { recentRecords: [record] } }))

    expect(await fetchRecentRecords()).toEqual([record])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://live.worldcubeassociation.org/api",
      expect.objectContaining({ method: "POST" })
    )
  })

  test("fails on an HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unavailable", { status: 503 })
    )

    await expect(fetchRecentRecords()).rejects.toThrow(
      "WCA Live recent records lookup failed (HTTP 503)."
    )
  })

  test("fails on a GraphQL error rather than reporting no records", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ data: null, errors: [{ message: "boom" }] })
    )

    await expect(fetchRecentRecords()).rejects.toThrow(
      "WCA Live recent records lookup returned an invalid response."
    )
  })
})
