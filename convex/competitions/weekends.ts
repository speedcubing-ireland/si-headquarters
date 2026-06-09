import { formatLocalDate, parseLocalDate } from "@/convex/competitions/dates"

export function getSaturdayOfWeek(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  const day = normalized.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(normalized)
  monday.setDate(normalized.getDate() - daysFromMonday)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  saturday.setHours(0, 0, 0, 0)
  return saturday
}

export function saturdaysInYear(year: number): string[] {
  const weekends: string[] = []
  const cursor = new Date(year, 0, 1)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getDay() !== 6) {
    cursor.setDate(cursor.getDate() + 1)
  }

  while (cursor.getFullYear() === year) {
    weekends.push(formatLocalDate(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return weekends
}

export function parseCompDateRange(
  from: string | null,
  to: string | null
): { start: Date; end: Date } | null {
  const start = from !== null && from !== "" ? parseLocalDate(from) : null
  const end = to !== null && to !== "" ? parseLocalDate(to) : null

  if (start === null && end === null) return null
  if (start !== null && end !== null) {
    return start.getTime() <= end.getTime()
      ? { start, end }
      : { start: end, end: start }
  }
  if (start !== null) return { start, end: start }
  if (end === null) return null
  return { start: end, end }
}

export function weekendLabel(weekendStart: string): string {
  const saturday = parseLocalDate(weekendStart)
  if (!saturday) return weekendStart
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  const satMonth = saturday.toLocaleString("en-IE", { month: "short" })
  const sunMonth = sunday.toLocaleString("en-IE", { month: "short" })

  if (satMonth === sunMonth) {
    return `${satMonth} ${String(saturday.getDate())}–${String(sunday.getDate())}`
  }
  return `${satMonth} ${String(saturday.getDate())} – ${sunMonth} ${String(sunday.getDate())}`
}
