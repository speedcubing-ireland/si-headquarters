import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  competitionById,
  getMyCompetitions,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type { CompetitionInfo } from "@/convex/plugins/wca/openapiClient/types.gen"
import { detectSponsorLabels } from "@/convex/plugins/socialMedia/lib/sponsorDetection"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"

export interface WcaDashboardCompetition {
  wcaCompetitionId: string
  name: string
  startDate: string
  endDate: string
  venue: string
  address: string
  eventIds: string[]
  competitorLimit: number | null
  registrationOpen: string | null
  sponsorLabels: string[]
  wcaUrl: string
}

function wcaCompetitionUrl(competitionId: string): string {
  return `${resolveWcaBaseUrl()}/competitions/${competitionId}`
}

function uniqueCompetitionIds(competitions: { id?: string }[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const competition of competitions) {
    const id = competition.id
    if (id === undefined || id === "" || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function formatCompetitionAddress(detail: CompetitionInfo): string {
  const venueAddress = detail.venue_address.trim()
  const city = detail.city.trim()

  if (
    venueAddress.length > 0 &&
    city.length > 0 &&
    !venueAddress.toLocaleLowerCase().includes(city.toLocaleLowerCase())
  ) {
    return `${venueAddress}, ${city}`
  }

  return venueAddress.length > 0 ? venueAddress : city
}

function mapCompetitionDetail(
  detail: CompetitionInfo
): WcaDashboardCompetition {
  const text = [
    detail.name,
    detail.information,
    detail.venue,
    detail.venue_address,
    detail.city,
    detail.extra_registration_requirements,
  ]
    .filter(Boolean)
    .join(" ")

  const wcaUrl = detail.url.trim()
  return {
    wcaCompetitionId: detail.id,
    name: detail.name,
    startDate: detail.start_date,
    endDate: detail.end_date,
    venue: detail.venue.trim(),
    address: formatCompetitionAddress(detail),
    eventIds: detail.event_ids,
    competitorLimit: detail.competitor_limit,
    registrationOpen: detail.registration_open,
    sponsorLabels: detectSponsorLabels(text),
    wcaUrl: wcaUrl.length > 0 ? wcaUrl : wcaCompetitionUrl(detail.id),
  }
}

export async function fetchFutureCompetitionDetails(
  accessToken: string
): Promise<WcaDashboardCompetition[]> {
  const client = createWcaClient(accessToken)
  const response = await getMyCompetitions({ client })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA my competitions lookup failed.")
  }

  const competitionIds = uniqueCompetitionIds(response.data.future_competitions)

  const detailResults = await Promise.all(
    competitionIds.map(async (id): Promise<WcaDashboardCompetition | null> => {
      const detailResponse = await competitionById({
        client,
        path: { competitionId: id },
      })
      if (detailResponse.data === undefined) {
        return null
      }
      return mapCompetitionDetail(detailResponse.data)
    })
  )

  return detailResults.filter(
    (competition): competition is WcaDashboardCompetition =>
      competition !== null
  )
}
