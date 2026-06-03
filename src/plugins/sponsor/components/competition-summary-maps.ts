import type { SponsorshipCompetitionSummary } from "@/convex/plugins/sponsor/lib/competitionSnapshot"

type CompetitionSummaryMapsInput = Pick<
  SponsorshipCompetitionSummary,
  "address" | "latitude" | "longitude"
>

export function buildGoogleMapsUrl(
  summary: CompetitionSummaryMapsInput
): string | null {
  const latitude = summary.latitude
  const longitude = summary.longitude
  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${String(latitude)},${String(longitude)}`
  }

  const query = summary.address.trim()
  if (query.length === 0) {
    return null
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
