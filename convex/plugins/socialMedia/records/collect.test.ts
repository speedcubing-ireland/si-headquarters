import { afterEach, describe, expect, test, vi } from "vitest"
import {
  fetchRecentRecords,
  selectWeeklyRecords,
} from "@/convex/plugins/socialMedia/records/collect"
import { recentRecord } from "@/convex/plugins/socialMedia/records/testFixtures"
import { weekWindowStartingOn } from "@/convex/plugins/socialMedia/records/window"

const WEEK = weekWindowStartingOn("2026-10-19")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("selectWeeklyRecords", () => {
  test("keeps the country's records from competitions that ended that week", () => {
    const records = [
      recentRecord({
        competitionName: "First Day",
        liveCompetitionId: "1",
        endDate: "2026-10-19",
      }),
      recentRecord({
        competitionName: "Last Day",
        liveCompetitionId: "2",
        endDate: "2026-10-25",
      }),
      recentRecord({
        competitionName: "Week Before",
        liveCompetitionId: "3",
        endDate: "2026-10-18",
      }),
      recentRecord({
        competitionName: "Week After",
        liveCompetitionId: "4",
        endDate: "2026-10-26",
      }),
      recentRecord({
        competitionName: "Abroad",
        liveCompetitionId: "5",
        countryIso2: "GB",
      }),
    ]

    expect(
      selectWeeklyRecords(records, "IE", WEEK).map(
        (competition) => competition.competitionName
      )
    ).toEqual(["First Day", "Last Day"])
  })

  test("orders records by event, round and type, and competitions by name", () => {
    const selected = selectWeeklyRecords(
      [
        recentRecord({
          eventId: "333",
          roundName: "Final",
          roundNumber: 2,
          type: "average",
        }),
        recentRecord({
          eventId: "333",
          roundName: "First Round",
          roundNumber: 1,
        }),
        recentRecord({ eventId: "222", tag: "WR" }),
        recentRecord({ eventId: "333", roundName: "Final", roundNumber: 2 }),
        recentRecord({
          competitionName: "Cork Open 2026",
          liveCompetitionId: "202",
        }),
      ],
      "IE",
      WEEK
    )

    expect(
      selected.map((competition) => [
        competition.competitionName,
        competition.records.map(
          (record) =>
            `${record.marker} ${record.eventId} ${record.roundName} ${record.type}`
        ),
      ])
    ).toEqual([
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

  test("keeps a newcomer who has no WCA ID yet", () => {
    const selected = selectWeeklyRecords(
      [recentRecord({ wcaId: null, personName: "New Comer" })],
      "IE",
      WEEK
    )

    expect(selected[0]?.records[0]).toMatchObject({
      wcaId: null,
      personName: "New Comer",
    })
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
