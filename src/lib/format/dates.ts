import { formatInTimeZone } from "date-fns-tz"
import { organisationConfig } from "@/config/lib/organisation"

const { locale, timeZone, timeZoneLabel } = organisationConfig.regional

export function formatDate(date: string): string {
  if (date.trim().length === 0) return "TBC"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  })
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDate(startDate)
  const end = formatDate(endDate)
  return start === end ? start : `${start} to ${end}`
}

export function formatDateTime(timestampMs: number): string {
  return `${formatInTimeZone(new Date(timestampMs), timeZone, "MMM d, yyyy 'at' HH:mm")} (${timeZoneLabel})`
}

export function formatDateTimeInConfiguredTimeZone(
  date: string | null | undefined
): string {
  if (date === null || date === undefined || date === "") {
    return "Not available"
  }
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return formatDateTime(parsed.getTime())
}
