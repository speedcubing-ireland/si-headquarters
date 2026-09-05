"use node"

import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  competitionList,
  getMyCompetitions,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"

export interface WcaStatusSources {
  /** Keyed by WCA competition id. Includes competitions not yet announced. */
  mine: Map<string, MyCompetition>
  /** Keyed by WCA competition id. Announced competitions in our country only. */
  index: Map<string, CompetitionIndex>
}

function byId<T extends { id: string }>(competitions: T[]): Map<string, T> {
  return new Map(
    competitions.map((competition) => [competition.id, competition])
  )
}

/**
 * Every competition the connected service account delegates or organises, past
 * and future, cancelled ones included — unlike `fetchManagedCompetitions`,
 * which drops them, the phase sync needs to see a cancellation.
 */
async function fetchMine(accessToken: string): Promise<MyCompetition[]> {
  const client = createWcaClient(accessToken)
  const response = await getMyCompetitions({ client })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA managed competitions lookup failed.")
  }
  return [
    ...response.data.past_competitions,
    ...response.data.future_competitions,
  ]
}

/**
 * Announced competitions in the organisation's country. This is the only source
 * carrying `registration_close`, which `MyCompetition` omits.
 */
async function fetchCountryIndex(
  accessToken: string,
  countryIso2: string
): Promise<CompetitionIndex[]> {
  const client = createWcaClient(accessToken)
  const response = await competitionList({
    client,
    query: { country_iso2: countryIso2, include_cancelled: true },
  })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA competition index lookup failed.")
  }
  return response.data
}

/**
 * Loads both WCA sources. Two requests total regardless of how many
 * competitions we run.
 *
 * The index is best-effort: it only adds the registration-close date, so losing
 * it costs one milestone rather than the whole sync.
 */
export async function fetchWcaStatusSources(
  accessToken: string,
  countryIso2: string | null
): Promise<WcaStatusSources> {
  const [mine, index] = await Promise.all([
    fetchMine(accessToken),
    countryIso2 === null
      ? Promise.resolve<CompetitionIndex[]>([])
      : fetchCountryIndex(accessToken, countryIso2).catch(() => []),
  ])

  return { mine: byId(mine), index: byId(index) }
}
