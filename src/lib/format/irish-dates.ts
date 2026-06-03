import { formatInTimeZone } from "date-fns-tz"

const DUBLIN_TZ = "Europe/Dublin"

export function formatDate(date: string): string {
  if (date.trim().length === 0) return "TBC"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DUBLIN_TZ,
  })
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDate(startDate)
  const end = formatDate(endDate)
  return start === end ? start : `${start} to ${end}`
}

export function formatDateTimeInDublin(
  date: string | null | undefined
): string {
  if (date === null || date === undefined || date === "") {
    return "Not available"
  }
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return `${formatInTimeZone(parsed, DUBLIN_TZ, "MMM d, yyyy 'at' HH:mm")} (Dublin)`
}
