import { v, type Infer } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import { competitionStartEnd } from "@/convex/competitions/dates"

export const sponsorshipCompetitionSummarySource = v.union(
  v.literal("competition_record"),
  v.literal("wca_pending"),
  v.literal("wca"),
  v.literal("custom")
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

export function resolveCompetitionSummaryView(
  snapshot: SponsorshipCompetitionSnapshot | undefined,
  fallback: Pick<Doc<"competitions">, "name" | "compDates">
): {
  summary: SponsorshipCompetitionSummary
  source: SponsorshipCompetitionSummarySource
  fetchedAt: number | undefined
} {
  return {
    summary: snapshot?.summary ?? buildCompetitionRecordSummary(fallback),
    source: snapshot?.source ?? "competition_record",
    fetchedAt: snapshot?.fetchedAt,
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

function toIsoDate(value: number): string {
  if (!Number.isFinite(value)) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export function buildCustomOfferingSummary(input: {
  name: string
  startsAt: number
  endsAt: number
}): SponsorshipCompetitionSummary {
  return {
    name: input.name,
    address: "",
    startDate: toIsoDate(input.startsAt),
    endDate: toIsoDate(input.endsAt),
    eventIds: [],
  }
}

export function buildCustomOfferingSnapshot(input: {
  name: string
  startsAt: number
  endsAt: number
}): SponsorshipCompetitionSnapshot {
  return buildCompetitionSnapshot({
    summary: buildCustomOfferingSummary(input),
    source: "custom",
  })
}

/**
 * Seed snapshot for a WCA-competition subject created without an HQ competition
 * record. The real venue/event data is filled in by the snapshot refresh action;
 * until then the summary just carries the WCA id as a placeholder name.
 */
export function buildWcaPlaceholderSnapshot(input: {
  wcaCompetitionId: string
  startsAt: number
  endsAt: number
}): SponsorshipCompetitionSnapshot {
  return buildCompetitionSnapshot({
    summary: {
      name: input.wcaCompetitionId,
      address: "",
      startDate: toIsoDate(input.startsAt),
      endDate: toIsoDate(input.endsAt),
      eventIds: [],
    },
    source: "wca_pending",
  })
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
