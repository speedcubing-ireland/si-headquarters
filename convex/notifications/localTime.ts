import { organisationConfig } from "@/config/lib/organisation"

const { locale, timeZone, reminderHour } = organisationConfig.regional

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

function ymdFromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDateForLocalYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function localToday(nowMs = Date.now()) {
  const parts = partsFor(new Date(nowMs))
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function localDateOffset(ymd: string, days: number) {
  const date = utcDateForLocalYmd(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return ymdFromUtcDate(date)
}

export function isConfiguredLocalTimeInWindow(
  startHour: number,
  endHour: number,
  nowMs = Date.now()
) {
  const { hour } = partsFor(new Date(nowMs))
  return hour >= startHour && hour < endHour
}

export function nextConfiguredReminderTime(nowMs = Date.now()) {
  const today = localToday(nowMs)
  const tomorrow = localDateOffset(today, 1)
  const candidate = localTimeToUtcMs(tomorrow, reminderHour, 0)
  return candidate <= nowMs
    ? localTimeToUtcMs(localDateOffset(tomorrow, 1), reminderHour, 0)
    : candidate
}

export function localTimeToUtcMs(ymd: string, hour: number, minute: number) {
  const [year, month, day] = ymd.split("-").map(Number)
  let guess = Date.UTC(year, month - 1, day, hour, minute)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsFor(new Date(guess))
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute)
    const offset = localAsUtc - guess
    const nextGuess = desiredAsUtc - offset
    if (Math.abs(nextGuess - guess) < 60_000) return nextGuess
    guess = nextGuess
  }

  return guess
}
