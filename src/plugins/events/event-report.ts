import { format, parseISO, subMonths } from "date-fns"
import type { EventReportRow } from "@/convex/plugins/events/validators"
import { competitionPrimaryEnd } from "@/convex/competitions/dates"
import { WCA_EVENT_LABELS } from "@/lib/wca-events"

export type EventReportScope = "current" | "past"

/** "Current" includes everything that ended within this many months. */
const CURRENT_WINDOW_MONTHS = 4
/** "Past" reaches back at most this many months. */
const PAST_WINDOW_MONTHS = 14

const EVENT_ORDER = new Map(
  Object.keys(WCA_EVENT_LABELS).map((eventId, index) => [eventId, index])
)

function monthsBefore(today: string, months: number): string {
  return format(subMonths(parseISO(today), months), "yyyy-MM-dd")
}

export function filterEventReportRows(
  rows: EventReportRow[],
  scope: EventReportScope,
  today: string
): EventReportRow[] {
  if (scope === "current") {
    // Future and ongoing competitions, plus anything that ended within the
    // window. Undated competitions are treated as upcoming.
    const cutoff = monthsBefore(today, CURRENT_WINDOW_MONTHS)
    return rows.filter((row) => {
      const endDate = competitionPrimaryEnd(row.dates)
      return endDate === null || endDate >= cutoff
    })
  }
  // Competitions that have already finished, back to the window edge.
  const cutoff = monthsBefore(today, PAST_WINDOW_MONTHS)
  return rows.filter((row) => {
    const endDate = competitionPrimaryEnd(row.dates)
    return endDate !== null && endDate < today && endDate >= cutoff
  })
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

/** Per-event column sums across the given rows, for the table footer. */
export function columnRoundTotals(rows: EventReportRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    for (const [eventId, rounds] of eventRoundsById(row)) {
      totals.set(eventId, (totals.get(eventId) ?? 0) + rounds)
    }
  }
  return totals
}

/** Grand total of all rounds across every event column. */
export function grandTotalRounds(rows: EventReportRow[]): number {
  let total = 0
  for (const rounds of columnRoundTotals(rows).values()) {
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
