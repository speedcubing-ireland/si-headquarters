import { describe, expect, test } from "vitest"
import { toHistoryRecords } from "@/convex/plugins/socialMedia/records/history"

/** Rows as the WCA's records history returns them, trimmed to a few fields. */
function historyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 8327848,
    pos: 2,
    person_id: "2020BERM02",
    person_name: "Adam Bermingham",
    country_id: "Ireland",
    competition_id: "IrishChampionshipFMC2026",
    event_id: "333fm",
    round_type_id: "f",
    best: 18,
    average: 2400,
    type: "single",
    value: 18,
    record_name: "NR",
    competition_name: "Irish Championship FMC 2026",
    start_date: "2026-07-11",
    competition_country_id: "Ireland",
    attempts: [29, 18, 25],
    ...overrides,
  }
}

describe("toHistoryRecords", () => {
  test("maps the WCA's history rows to stored records", () => {
    // An object lists integer-like keys such as "333" first.
    const json = {
      records: {
        "333fm": [historyRow()],
        "333": [
          historyRow({
            id: 77,
            event_id: "333",
            round_type_id: "1",
            type: "average",
            value: 1023,
            record_name: "ER",
          }),
        ],
      },
    }

    expect(toHistoryRecords(JSON.stringify(json), "IE")).toEqual([
      expect.objectContaining({
        liveRecordId: "wca:77:average",
        tag: "CR",
        type: "average",
        attemptResult: 1023,
        roundName: "First Round",
        roundNumber: 1,
      }),
      {
        liveRecordId: "wca:8327848:single",
        status: "confirmed",
        tag: "NR",
        type: "single",
        attemptResult: 18,
        eventId: "333fm",
        roundName: "Final",
        roundNumber: 5,
        personName: "Adam Bermingham",
        wcaId: "2020BERM02",
        personCountryIso2: "IE",
        liveCompetitionId: null,
        wcaCompetitionId: "IrishChampionshipFMC2026",
        competitionName: "Irish Championship FMC 2026",
        competitionStartDate: "2026-07-11",
        competitionEndDate: "2026-07-11",
      },
    ])
  })

  test("refuses a history with competitors from more than one country", () => {
    const json = {
      records: {
        "333fm": [historyRow(), historyRow({ id: 2, country_id: "France" })],
      },
    }

    expect(() => toHistoryRecords(JSON.stringify(json), "IE")).toThrow(
      /Ireland, France/
    )
  })

  test("refuses a file that is not a records history", () => {
    expect(() =>
      toHistoryRecords(JSON.stringify({ records: [] }), "IE")
    ).toThrow(/Not a WCA records history/)
  })
})
