import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  parse,
  parseISO,
  startOfToday,
} from "date-fns"
import type { DateRange } from "react-day-picker"
import { competitionPrimaryStart } from "@/convex/competitions/dates"

export interface CompetitionDateRangeValue {
  from: string | null
  to: string | null
}

function parseCompetitionDate(isoDate: string) {
  return parse(isoDate, "yyyy-MM-dd", new Date())
}

export function formatCompetitionCountdown(
  compDates: CompetitionDateRangeValue
): string {
  const startIso = competitionPrimaryStart(compDates)
  if (startIso === null) return "No date"

  const start = parseCompetitionDate(startIso)
  if (isToday(start)) return "Today"
  if (isTomorrow(start)) return "Tomorrow"

  const days = differenceInCalendarDays(start, startOfToday())
  if (days < 0) return `${String(Math.abs(days))}d ago`
  return `${String(days)}d`
}

export function toDateRange(
  from: string | null,
  to: string | null
): DateRange | undefined {
  const range = {
    from: from !== null ? parseISO(from) : undefined,
    to: to !== null ? parseISO(to) : undefined,
  }

  return range.from !== undefined || range.to !== undefined ? range : undefined
}

export function formatCompetitionDateRangeText(from?: Date, to?: Date) {
  if (!from) return "Pick a date"
  if (!to) return `${format(from, "LLL dd, y")} - Pick end`

  const sameDate = from.getTime() === to.getTime()
  if (sameDate) return format(from, "LLL dd, y")

  const sameYear = from.getFullYear() === to.getFullYear()
  return `${format(from, sameYear ? "LLL dd" : "LLL dd, y")} - ${format(
    to,
    "LLL dd, y"
  )}`
}

export function formatCompetitionDateRange(
  compDates: CompetitionDateRangeValue
) {
  const range = toDateRange(compDates.from, compDates.to)
  return formatCompetitionDateRangeText(range?.from, range?.to)
}
