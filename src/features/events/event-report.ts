import type { EventReportRow } from "@/convex/events/validators"
import { competitionPrimaryEnd } from "@/convex/competitions/dates"
import { WCA_EVENT_LABELS } from "@/lib/wca-events"

export type EventReportScope = "upcoming" | "past" | "all"

const EVENT_ORDER = new Map(
  Object.keys(WCA_EVENT_LABELS).map((eventId, index) => [eventId, index])
)

function isPastCompetition(
  row: Pick<EventReportRow, "dates">,
  today: string
): boolean {
  const endDate = competitionPrimaryEnd(row.dates)
  return endDate !== null && endDate < today
}

export function filterEventReportRows(
  rows: EventReportRow[],
  scope: EventReportScope,
  today: string
): EventReportRow[] {
  if (scope === "all") {
    return rows
  }
  return rows.filter((row) =>
    scope === "past"
      ? isPastCompetition(row, today)
      : !isPastCompetition(row, today)
  )
}

export function buildEventColumns(rows: EventReportRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    for (const event of row.events) {
      seen.add(event.eventId)
    }
  }
  return [...seen].sort(
    (left, right) =>
      (EVENT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (EVENT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right)
  )
}

export function eventRoundsById(row: EventReportRow): Map<string, number> {
  return new Map(row.events.map((event) => [event.eventId, event.rounds]))
}

export function totalRounds(row: EventReportRow): number {
  let total = 0
  for (const rounds of eventRoundsById(row).values()) {
    total += rounds
  }
  return total
}

export function reportFetchedAt(rows: EventReportRow[]): number | null {
  if (rows.length === 0) {
    return null
  }

  let oldest = Number.POSITIVE_INFINITY
  for (const row of rows) {
    if (row.fetchedAt === null) {
      return null
    }
    oldest = Math.min(oldest, row.fetchedAt)
  }
  return oldest
}
