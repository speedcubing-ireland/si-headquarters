import { format, isValid, parse } from "date-fns"
import { enGB, enIE } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import type { OrganisationLocale } from "@/config/lib/organisation-schema"
import { organisationConfig } from "@/config/lib/organisation"

const { locale, timeZone, timeZoneLabel } = organisationConfig.regional

function localeFormatOptions(orgLocale: OrganisationLocale): {
  locale: typeof enGB
} {
  switch (orgLocale) {
    case "en-GB":
      return { locale: enGB }
    case "en-IE":
      return { locale: enIE }
  }
}

const formatOptions = localeFormatOptions(locale)

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_ONLY_PARSE_FORMAT = "yyyy-MM-dd"
const CALENDAR_DATE_FORMAT = "d MMM yyyy"

export function formatDate(date: string): string {
  const trimmed = date.trim()
  if (trimmed.length === 0) return "TBC"
  if (ISO_DATE_ONLY.test(trimmed)) {
    const parsed = parse(trimmed, DATE_ONLY_PARSE_FORMAT, new Date())
    if (!isValid(parsed)) return date
    return format(parsed, CALENDAR_DATE_FORMAT, formatOptions)
  }

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return formatInTimeZone(parsed, timeZone, CALENDAR_DATE_FORMAT, formatOptions)
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
