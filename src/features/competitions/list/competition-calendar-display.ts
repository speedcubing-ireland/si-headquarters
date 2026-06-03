import { parseLocalDate } from "@/convex/competitions/dates"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"
export type CompetitionCalendarRow = FunctionReturnType<
  typeof api.competitions.calendar.listForYear
>["rows"][number]

export type CompetitionCalendarCompetitionRow = Extract<
  CompetitionCalendarRow,
  { kind: "competition" }
>

export type CompetitionDateChip =
  | { kind: "tbd" }
  | { kind: "single"; month: string; day: string }
  | { kind: "range"; month: string; startDay: string; endDay: string }
  | {
      kind: "span"
      startMonth: string
      startDay: string
      endMonth: string
      endDay: string
    }

export interface CalendarMonthGroup {
  key: string
  label: string
  rows: CompetitionCalendarRow[]
}

export function getCalendarMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

export function getInitialScrollMonthKey(
  year: number,
  now: Date = new Date()
): string | null {
  if (year !== now.getFullYear()) {
    return null
  }
  return getCalendarMonthKey(year, now.getMonth())
}

function formatMonthShort(date: Date): string {
  return date.toLocaleString("en-IE", { month: "short" }).toUpperCase()
}

export function getCompetitionDateChip(
  row: Pick<CompetitionCalendarCompetitionRow, "compDates">
): CompetitionDateChip {
  const fromIso = row.compDates.from
  const toIso = row.compDates.to

  if (fromIso === null) {
    return { kind: "tbd" }
  }

  const start = parseLocalDate(fromIso)
  if (start === null) {
    return { kind: "tbd" }
  }

  if (toIso === null || toIso === fromIso) {
    return {
      kind: "single",
      month: formatMonthShort(start),
      day: String(start.getDate()),
    }
  }

  const end = parseLocalDate(toIso)
  if (end === null) {
    return {
      kind: "single",
      month: formatMonthShort(start),
      day: String(start.getDate()),
    }
  }

  const rangeStart = start <= end ? start : end
  const rangeEnd = start <= end ? end : start

  if (
    rangeStart.getFullYear() === rangeEnd.getFullYear() &&
    rangeStart.getMonth() === rangeEnd.getMonth() &&
    rangeStart.getDate() === rangeEnd.getDate()
  ) {
    return {
      kind: "single",
      month: formatMonthShort(rangeStart),
      day: String(rangeStart.getDate()),
    }
  }

  if (
    rangeStart.getFullYear() === rangeEnd.getFullYear() &&
    rangeStart.getMonth() === rangeEnd.getMonth()
  ) {
    return {
      kind: "range",
      month: formatMonthShort(rangeStart),
      startDay: String(rangeStart.getDate()),
      endDay: String(rangeEnd.getDate()),
    }
  }

  return {
    kind: "span",
    startMonth: formatMonthShort(rangeStart),
    startDay: String(rangeStart.getDate()),
    endMonth: formatMonthShort(rangeEnd),
    endDay: String(rangeEnd.getDate()),
  }
}

export function groupCalendarRowsByMonth(
  rows: CompetitionCalendarRow[]
): CalendarMonthGroup[] {
  const groups: CalendarMonthGroup[] = []
  let current: CalendarMonthGroup | null = null

  for (const row of rows) {
    const iso = row.kind === "weekend" ? row.weekendStart : row.compDates.from
    const date = iso !== null && iso !== "" ? parseLocalDate(iso) : null
    const key =
      date !== null
        ? `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : "no-date"
    const label =
      date !== null && key !== "no-date"
        ? date.toLocaleString("en-IE", { month: "long" })
        : "No date set"

    if (current === null) {
      current = { key, label, rows: [] }
      groups.push(current)
    } else if (current.key !== key) {
      current = { key, label, rows: [] }
      groups.push(current)
    }
    current.rows.push(row)
  }

  return groups
}
