/** e.g. "my cool comp 2026" + year 2026 → "MCC26" */
export function formatCompetitionShortcut(
  name: string,
  year: number | null
): string {
  const initials = name
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^\d{4}$/.test(part))
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  const yearSuffix = year !== null ? String(year).slice(-2) : ""

  return `${initials}${yearSuffix}`
}
