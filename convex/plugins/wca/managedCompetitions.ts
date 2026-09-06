"use node"

import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { createWcaClient } from "@/convex/plugins/wca/client"
import { getMyCompetitions } from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type { MyCompetition } from "@/convex/plugins/wca/openapiClient/types.gen"

export interface ManagedWcaCompetition {
  id: string
  name: string
  startDate: string
  endDate: string
  url: string
  /** Whether the competition is publicly visible (announced) on the WCA. */
  isPublic: boolean
}

function mapManagedCompetition(
  competition: MyCompetition
): ManagedWcaCompetition {
  return {
    id: competition.id,
    name: competition.name,
    startDate: competition.start_date,
    endDate: competition.end_date,
    url:
      competition.url.length > 0
        ? competition.url
        : `${resolveWcaBaseUrl()}/competitions/${competition.id}`,
    isPublic: competition["visible?"],
  }
}

/**
 * Raw competitions managed (delegated or organised) by the connected WCA
 * account, past and future, cancelled ones included. Bookmarked competitions
 * are intentionally excluded so callers only see our own competitions.
 *
 * Callers decide what to filter: the events report drops cancellations, the
 * phase sync needs to see them.
 */
export async function listMyCompetitions(
  accessToken: string
): Promise<MyCompetition[]> {
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
 * Managed competitions for the events report. Cancelled competitions are
 * dropped.
 */
export async function fetchManagedCompetitions(
  accessToken: string
): Promise<ManagedWcaCompetition[]> {
  const byId = new Map<string, ManagedWcaCompetition>()
  for (const competition of await listMyCompetitions(accessToken)) {
    if (competition["cancelled?"]) {
      continue
    }
    byId.set(competition.id, mapManagedCompetition(competition))
  }
  return [...byId.values()]
}
