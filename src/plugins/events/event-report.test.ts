import { describe, expect, test } from "vitest"
import type { EventReportRow } from "@/convex/plugins/events/validators"
import {
  buildEventColumns,
  columnRoundTotals,
  eventRoundsById,
  filterEventReportRows,
  grandTotalRounds,
  reportFetchedAt,
  totalRounds,
} from "@/plugins/events/event-report"

function reportRow(
  name: string,
  from: string | null,
  to: string | null,
  events: EventReportRow["events"] = []
): EventReportRow {
  return {
    key: name,
    competitionId: name as EventReportRow["competitionId"],
    competitionName: name,
    dates: { from, to },
    sheet: { sheetId: name, title: name, url: `https://sheet/${name}` },
    wcaCompetition: null,
    source: "sheet",
    events,
    fetchedAt: 1,
    error: null,
  }
}

describe("event report", () => {
  test("current scope shows future, ongoing, undated, and recently finished", () => {
    const longPast = reportRow("Long past", "2024-01-01", "2024-01-02")
    const past = reportRow("Past", "2026-01-01", "2026-01-02")
    const recent = reportRow("Recent", "2026-05-01", "2026-05-02")
    const ongoing = reportRow("Ongoing", "2026-06-28", "2026-06-30")
    const future = reportRow("Future", "2026-08-01", "2026-08-02")
    const undated = reportRow("Undated", null, null)
    const rows = [longPast, past, recent, ongoing, future, undated]

    expect(filterEventReportRows(rows, "current", "2026-06-29")).toEqual([
      recent,
      ongoing,
      future,
      undated,
    ])
  })

  test("past scope shows finished competitions within the last 14 months", () => {
    const longPast = reportRow("Long past", "2024-01-01", "2024-01-02")
    const past = reportRow("Past", "2026-01-01", "2026-01-02")
    const recent = reportRow("Recent", "2026-05-01", "2026-05-02")
    const ongoing = reportRow("Ongoing", "2026-06-28", "2026-06-30")
    const toOnly = reportRow("To only", null, "2026-01-02")
    const rows = [longPast, past, recent, ongoing, toOnly]

    expect(filterEventReportRows(rows, "past", "2026-06-29")).toEqual([
      past,
      recent,
      toOnly,
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

  test("sums round counts per column and overall for the footer", () => {
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

    const totals = columnRoundTotals(rows)
    expect(totals.get("222")).toBe(5)
    expect(totals.get("333")).toBe(4)
    expect(totals.get("clock")).toBe(1)
    expect(grandTotalRounds(rows)).toBe(10)
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
