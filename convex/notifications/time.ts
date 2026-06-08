const DUBLIN_TIME_ZONE = "Europe/Dublin"

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: DUBLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  }
}

function ymdFromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDateForLocalYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function dublinToday(nowMs = Date.now()) {
  const parts = partsFor(new Date(nowMs))
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function dublinDateOffset(ymd: string, days: number) {
  const date = utcDateForLocalYmd(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return ymdFromUtcDate(date)
}

export function isDublinLocalHour(hour: number, nowMs = Date.now()) {
  return partsFor(new Date(nowMs)).hour === hour
}

export function nextDublinEightAm(nowMs = Date.now()) {
  const today = dublinToday(nowMs)
  const tomorrow = dublinDateOffset(today, 1)
  const candidate = localDublinTimeToUtcMs(tomorrow, 8, 0)
  return candidate <= nowMs
    ? localDublinTimeToUtcMs(dublinDateOffset(tomorrow, 1), 8, 0)
    : candidate
}

export function localDublinTimeToUtcMs(
  ymd: string,
  hour: number,
  minute: number
) {
  const [year, month, day] = ymd.split("-").map(Number)
  let guess = Date.UTC(year, month - 1, day, hour, minute)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsFor(new Date(guess))
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour
    )
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute)
    const offset = localAsUtc - guess
    const nextGuess = desiredAsUtc - offset
    if (Math.abs(nextGuess - guess) < 60_000) return nextGuess
    guess = nextGuess
  }

  return guess
}
