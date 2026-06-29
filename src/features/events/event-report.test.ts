import { describe, expect, test } from "vitest"
import type { EventReportRow } from "@/convex/events/validators"
import {
  buildEventColumns,
  eventRoundsById,
  filterEventReportRows,
  reportFetchedAt,
  totalRounds,
} from "@/features/events/event-report"

function reportRow(
  name: string,
  from: string | null,
  to: string | null,
  events: EventReportRow["events"] = []
): EventReportRow {
  return {
    competitionId: name as EventReportRow["competitionId"],
    competitionName: name,
    dates: { from, to },
    sheet: { sheetId: name, title: name, url: `https://sheet/${name}` },
    wcaCompetition: null,
    events,
    fetchedAt: 1,
    error: null,
  }
}

describe("event report", () => {
  test("separates completed competitions from upcoming and undated ones", () => {
    const past = reportRow("Past", "2026-01-01", "2026-01-02")
    const current = reportRow("Current", "2026-06-28", "2026-06-30")
    const future = reportRow("Future", "2026-08-01", "2026-08-02")
    const undated = reportRow("Undated", null, null)
    const toOnly = reportRow("To only", null, "2026-01-02")
    const rows = [past, current, future, undated, toOnly]

    expect(filterEventReportRows(rows, "past", "2026-06-29")).toEqual([
      past,
      toOnly,
    ])
    expect(filterEventReportRows(rows, "upcoming", "2026-06-29")).toEqual([
      current,
      future,
      undated,
    ])
  })

  test("builds stable columns and totals numeric round counts", () => {
    const rows = [
      reportRow("One", null, null, [
        { eventId: "333", rounds: 4 },
        { eventId: "222", rounds: 3 },
      ]),
      reportRow("Two", null, null, [
        { eventId: "222", rounds: 2 },
        { eventId: "clock", rounds: 1 },
      ]),
    ]

    expect(buildEventColumns(rows)).toEqual(["222", "333", "clock"])
    expect(totalRounds(rows[0])).toBe(7)
  })

  test("uses the displayed event value when defensively totaling duplicates", () => {
    const row = reportRow("Duplicate", null, null, [
      { eventId: "333", rounds: 4 },
      { eventId: "333", rounds: 3 },
    ])

    expect(eventRoundsById(row).get("333")).toBe(3)
    expect(totalRounds(row)).toBe(3)
  })

  test("uses the oldest complete row for aggregate report freshness", () => {
    const older = reportRow("Older", null, null)
    older.fetchedAt = 10
    const newer = reportRow("Newer", null, null)
    newer.fetchedAt = 20

    expect(reportFetchedAt([newer, older])).toBe(10)
    newer.fetchedAt = null
    expect(reportFetchedAt([older, newer])).toBeNull()
  })
})
