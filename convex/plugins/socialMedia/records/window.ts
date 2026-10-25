import { organisationConfig } from "@/config/lib/organisation"
import { localDateOffset, localToday } from "@/convex/notifications/localTime"

/** Day of the week of a calendar date, Monday = 0 … Sunday = 6. */
function weekdayIndex(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

/**
 * On a local Monday, the Monday (YYYY-MM-DD) a week earlier: the start of the
 * week the email reports on, which identifies the weekly run. Null on any other
 * day, when there is nothing to send.
 */
export function weekToReport(nowMs: number): string | null {
  const today = localToday(nowMs)
  return weekdayIndex(today) === 0 ? localDateOffset(today, -7) : null
}

/**
 * "19–25 Oct 2026", "28 Sep – 4 Oct 2026" or "28 Dec 2026 – 3 Jan 2027" for the
 * week starting on `weekStart`.
 *
 * Composed by hand rather than with `Intl.DateTimeFormat.formatRange`, whose
 * spacing around the dash differs between ICU builds — the email subject would
 * otherwise change with whichever Node the runtime ships.
 */
export function formatWeekLabel(weekStart: string): string {
  const monthFormat = new Intl.DateTimeFormat(
    organisationConfig.regional.locale,
    { month: "short", timeZone: "UTC" }
  )
  const parts = (ymd: string) => {
    const [year, month, day] = ymd.split("-").map(Number)
    return {
      year: String(year),
      month: monthFormat.format(new Date(Date.UTC(year, month - 1, day))),
      day: String(day),
    }
  }
  const first = parts(weekStart)
  const last = parts(localDateOffset(weekStart, 6))

  if (first.year !== last.year) {
    return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`
  }
  if (first.month !== last.month) {
    return `${first.day} ${first.month} – ${last.day} ${last.month} ${last.year}`
  }
  return `${first.day}–${last.day} ${last.month} ${last.year}`
}
