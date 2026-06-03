import { v, type Infer } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import { competitionStartEnd } from "@/convex/competitions/dates"

export const sponsorshipCompetitionSummarySource = v.union(
  v.literal("competition_record"),
  v.literal("wca")
)

export type SponsorshipCompetitionSummarySource = Infer<
  typeof sponsorshipCompetitionSummarySource
>

export const sponsorshipCompetitionSummary = v.object({
  name: v.string(),
  address: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  competitorLimit: v.optional(v.number()),
  eventIds: v.array(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
})

export type SponsorshipCompetitionSummary = Infer<
  typeof sponsorshipCompetitionSummary
>

export const competitionSnapshot = v.object({
  summary: sponsorshipCompetitionSummary,
  source: sponsorshipCompetitionSummarySource,
  fetchedAt: v.number(),
})

export type SponsorshipCompetitionSnapshot = Infer<typeof competitionSnapshot>

function buildAddress(input: {
  venue?: string
  city?: string
  countryIso2?: string
}): string {
  const parts = [input.venue, input.city, input.countryIso2]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
  return parts.join(", ")
}

export function buildCompetitionRecordSummary(
  competition: Pick<Doc<"competitions">, "name" | "compDates">
): SponsorshipCompetitionSummary {
  const { compStart, compEnd } = competitionStartEnd(competition)
  return {
    name: competition.name,
    address: "",
    startDate: compStart,
    endDate: compEnd,
    eventIds: [],
  }
}

export function buildWcaCompetitionSummary(details: {
  name: string
  venue: string
  city: string
  country_iso2: string
  start_date: string
  end_date: string
  competitor_limit: number | null
  event_ids: string[]
  venue_address?: string
  latitude_degrees?: number
  longitude_degrees?: number
}): SponsorshipCompetitionSummary {
  const venueAddress = details.venue_address?.trim() ?? ""
  const address =
    venueAddress.length > 0
      ? venueAddress
      : buildAddress({
          venue: details.venue,
          city: details.city,
          countryIso2: details.country_iso2,
        })
  const latitude = details.latitude_degrees
  const longitude = details.longitude_degrees
  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)

  return {
    name: details.name,
    address,
    startDate: details.start_date,
    endDate: details.end_date,
    competitorLimit:
      typeof details.competitor_limit === "number"
        ? details.competitor_limit
        : undefined,
    eventIds: details.event_ids,
    ...(hasCoordinates ? { latitude, longitude } : {}),
  }
}

export function buildCompetitionSnapshot(input: {
  summary: SponsorshipCompetitionSummary
  source: SponsorshipCompetitionSummarySource
  fetchedAt?: number
}): SponsorshipCompetitionSnapshot {
  return {
    summary: input.summary,
    source: input.source,
    fetchedAt: input.fetchedAt ?? Date.now(),
  }
}
