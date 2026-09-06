"use node"

import { createWcaClient } from "@/convex/plugins/wca/client"
import { listMyCompetitions } from "@/convex/plugins/wca/managedCompetitions"
import { competitionList } from "@/convex/plugins/wca/openapiClient/sdk.gen"
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
 * Announced competitions in the organisation's country. This is the only source
 * carrying `registration_close`, which `MyCompetition` omits.
 *
 * `onlyCompetitionId` narrows the request to one competition — without it a
 * single-competition sync would download every competition the country has ever
 * held to read one date.
 */
async function fetchCountryIndex(
  accessToken: string,
  countryIso2: string,
  onlyCompetitionId: string | undefined
): Promise<CompetitionIndex[]> {
  const client = createWcaClient(accessToken)
  const response = await competitionList({
    client,
    query: {
      country_iso2: countryIso2,
      include_cancelled: true,
      ...(onlyCompetitionId === undefined ? {} : { q: onlyCompetitionId }),
    },
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
 * The index is best-effort: it only adds the registration-close date, and the
 * caller merges onto the stored status, so losing it costs nothing already
 * known rather than the whole sync.
 */
export async function fetchWcaStatusSources(
  accessToken: string,
  countryIso2: string,
  onlyCompetitionId?: string
): Promise<WcaStatusSources> {
  const [mine, index] = await Promise.all([
    listMyCompetitions(accessToken),
    loadCountryIndexOrNone(accessToken, countryIso2, onlyCompetitionId),
  ])

  return { mine: byId(mine), index: byId(index) }
}

async function loadCountryIndexOrNone(
  accessToken: string,
  countryIso2: string,
  onlyCompetitionId: string | undefined
): Promise<CompetitionIndex[]> {
  try {
    return await fetchCountryIndex(accessToken, countryIso2, onlyCompetitionId)
  } catch (error) {
    console.warn("WCA competition index unavailable this run", error)
    return []
  }
}
