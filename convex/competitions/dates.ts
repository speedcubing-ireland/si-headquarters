import type { Doc } from "@/convex/_generated/dataModel"

/** Parse `YYYY-MM-DD` as local calendar date (no time). */
export function parseLocalDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${String(y)}-${m}-${d}`
}

export function competitionStartEnd(
  competition: Pick<Doc<"competitions">, "compDates">
): { compStart: string; compEnd: string } {
  const compStart = competition.compDates.from ?? ""
  const compEnd = competition.compDates.to ?? competition.compDates.from ?? ""
  return { compStart, compEnd }
}

export function todayIsoDate(): string {
  return formatLocalDate(new Date())
}
