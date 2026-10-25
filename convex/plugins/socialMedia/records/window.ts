import { organisationConfig } from "@/config/lib/organisation"
import {
  localDateOffset,
  localTimeToUtcMs,
  localToday,
} from "@/convex/notifications/localTime"

export interface WeekWindow {
  /** Local Monday (YYYY-MM-DD) the week starts on; identifies the weekly run. */
  weekStart: string
  /** Local Monday 00:00 of `weekStart`, inclusive. */
  startMs: number
  /** Local Monday 00:00 a week later, exclusive. */
  endMs: number
}

/** Day of the week of a calendar date, Monday = 0 … Sunday = 6. */
function weekdayIndex(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

export function isLocalMonday(nowMs: number): boolean {
  return weekdayIndex(localToday(nowMs)) === 0
}

/**
 * The local Monday-to-Monday week starting on `weekStart`. Both bounds are local
 * midnights converted to UTC, so a week that crosses a DST change is 167 or 169
 * hours long rather than drifting by an hour.
 */
export function weekWindowStartingOn(weekStart: string): WeekWindow {
  if (weekdayIndex(weekStart) !== 0) {
    throw new Error(`Week start ${weekStart} is not a Monday.`)
  }
  return {
    weekStart,
    startMs: localTimeToUtcMs(weekStart, 0, 0),
    endMs: localTimeToUtcMs(localDateOffset(weekStart, 7), 0, 0),
  }
}

/** The full local week before the one `nowMs` falls in. */
export function previousWeekWindow(nowMs: number): WeekWindow {
  const today = localToday(nowMs)
  const thisMonday = localDateOffset(today, -weekdayIndex(today))
  return weekWindowStartingOn(localDateOffset(thisMonday, -7))
}

/**
 * "19–25 Oct 2026", "28 Sep – 4 Oct 2026" or "28 Dec 2026 – 3 Jan 2027".
 *
 * Composed by hand rather than with `Intl.DateTimeFormat.formatRange`, whose
 * spacing around the dash differs between ICU builds — the email subject would
 * otherwise change with whichever Node the runtime ships.
 */
export function formatWeekLabel(window: WeekWindow): string {
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
  const first = parts(window.weekStart)
  const last = parts(localDateOffset(window.weekStart, 6))

  if (first.year !== last.year) {
    return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`
  }
  if (first.month !== last.month) {
    return `${first.day} ${first.month} – ${last.day} ${last.month} ${last.year}`
  }
  return `${first.day}–${last.day} ${last.month} ${last.year}`
}
