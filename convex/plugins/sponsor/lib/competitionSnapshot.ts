import { v } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import { competitionStartEnd } from "@/convex/competitions/dates"

export const sponsorshipCompetitionSummarySource = v.union(
  v.literal("competition_record"),
  v.literal("wca")
)

export type SponsorshipCompetitionSummarySource = "competition_record" | "wca"

export const sponsorshipCompetitionSummary = v.object({
  name: v.string(),
  address: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  competitorLimit: v.optional(v.number()),
  eventIds: v.array(v.string()),
})

export interface SponsorshipCompetitionSummary {
  name: string
  address: string
  startDate: string
  endDate: string
  competitorLimit?: number
  eventIds: string[]
}

export const competitionSnapshot = v.object({
  summary: sponsorshipCompetitionSummary,
  source: sponsorshipCompetitionSummarySource,
  fetchedAt: v.number(),
})

export interface SponsorshipCompetitionSnapshot {
  summary: SponsorshipCompetitionSummary
  source: SponsorshipCompetitionSummarySource
  fetchedAt: number
}

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
}): SponsorshipCompetitionSummary {
  return {
    name: details.name,
    address: buildAddress({
      venue: details.venue,
      city: details.city,
      countryIso2: details.country_iso2,
    }),
    startDate: details.start_date,
    endDate: details.end_date,
    competitorLimit:
      typeof details.competitor_limit === "number"
        ? details.competitor_limit
        : undefined,
    eventIds: details.event_ids,
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
