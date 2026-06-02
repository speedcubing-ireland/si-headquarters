interface CompetitionSummary {
  name: string
  address: string
  startDate: string
  endDate: string
  competitorLimit?: number
  eventIds: string[]
}

export function formatDate(date: string): string {
  if (date.trim().length === 0) return "TBC"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Dublin",
  })
}

export function formatDateRange(summary: CompetitionSummary): string {
  const start = formatDate(summary.startDate)
  const end = formatDate(summary.endDate)
  return start === end ? start : `${start} to ${end}`
}
