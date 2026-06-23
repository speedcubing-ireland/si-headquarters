"use node"

import { v } from "convex/values"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  competitionList2,
  getMyCompetitions,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"

export const wcaCompetitionOption = v.object({
  id: v.string(),
  name: v.string(),
  city: v.string(),
  countryIso2: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  url: v.string(),
})

export interface WcaCompetitionOption {
  id: string
  name: string
  city: string
  countryIso2: string
  startDate: string
  endDate: string
  url: string
}

export function mapCompetitionOption(
  competition: MyCompetition | CompetitionIndex
): WcaCompetitionOption {
  return {
    id: competition.id,
    name: competition.name,
    city: competition.city,
    countryIso2: competition.country_iso2,
    startDate: competition.start_date,
    endDate: competition.end_date,
    url:
      "url" in competition
        ? competition.url
        : `${resolveWcaBaseUrl()}/competitions/${competition.id}`,
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

export async function fetchMyCompetitionOptions(
  accessToken: string
): Promise<WcaCompetitionOption[]> {
  const client = createWcaClient(accessToken)
  const response = await getMyCompetitions({ client })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA my competitions lookup failed.")
  }

  return uniqueById(
    [
      ...response.data.future_competitions,
      ...response.data.past_competitions,
      ...response.data.bookmarked_competitions,
    ].map(mapCompetitionOption)
  )
}

export async function searchCompetitionOptions(
  accessToken: string,
  query: string
): Promise<WcaCompetitionOption[]> {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return []
  }
  const client = createWcaClient(accessToken)
  const response = await competitionList2({
    client,
    query: { q: trimmed, sort: "-start_date" },
  })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA competition search failed.")
  }

  return response.data.slice(0, 20).map(mapCompetitionOption)
}
