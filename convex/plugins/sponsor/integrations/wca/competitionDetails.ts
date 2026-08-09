import { v, type Infer } from "convex/values"
import { createWcaClient } from "@/convex/plugins/wca/client"
import { competitionById } from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type { CompetitionInfo } from "@/convex/plugins/wca/openapiClient/types.gen"

export const sponsorshipWcaCompetitionDetails = v.object({
  id: v.string(),
  name: v.string(),
  city: v.string(),
  country_iso2: v.string(),
  start_date: v.string(),
  end_date: v.string(),
  event_ids: v.array(v.string()),
  competitor_limit: v.union(v.number(), v.null()),
  venue: v.string(),
  venue_address: v.optional(v.string()),
  latitude_degrees: v.optional(v.number()),
  longitude_degrees: v.optional(v.number()),
})

export type SponsorshipWcaCompetitionDetails = Infer<
  typeof sponsorshipWcaCompetitionDetails
>

export const sponsorshipWcaCompetitionDetailsFetchResult = v.union(
  v.object({
    status: v.literal("found"),
    details: sponsorshipWcaCompetitionDetails,
  }),
  v.object({ status: v.literal("not_found") }),
  v.object({ status: v.literal("fetch_failed") })
)

export type SponsorshipWcaCompetitionDetailsFetchResult = Infer<
  typeof sponsorshipWcaCompetitionDetailsFetchResult
>

export function mapCompetitionInfoToDetails(
  detail: CompetitionInfo
): SponsorshipWcaCompetitionDetails {
  const venueAddress = detail.venue_address.trim()
  return {
    id: detail.id,
    name: detail.name,
    city: detail.city,
    country_iso2: detail.country_iso2,
    start_date: detail.start_date,
    end_date: detail.end_date,
    event_ids: detail.event_ids,
    competitor_limit: detail.competitor_limit,
    venue: detail.venue,
    ...(venueAddress.length > 0 ? { venue_address: venueAddress } : {}),
    ...(Number.isFinite(detail.latitude_degrees)
      ? { latitude_degrees: detail.latitude_degrees }
      : {}),
    ...(Number.isFinite(detail.longitude_degrees)
      ? { longitude_degrees: detail.longitude_degrees }
      : {}),
  }
}

export async function fetchCompetitionDetails(
  accessToken: string,
  wcaCompetitionId: string
): Promise<SponsorshipWcaCompetitionDetailsFetchResult> {
  const client = createWcaClient(accessToken)
  const response = await competitionById({
    client,
    path: { competitionId: wcaCompetitionId },
  })
  if (response.data === undefined) {
    return {
      status: response.response?.status === 404 ? "not_found" : "fetch_failed",
    }
  }
  return {
    status: "found",
    details: mapCompetitionInfoToDetails(response.data),
  }
}
