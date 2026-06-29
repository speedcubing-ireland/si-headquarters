"use node"

import { resolveWcaApiBaseUrl } from "@/convex/deploymentContext"
import {
  isPlainObject,
  readJsonObject,
  readObjectArray,
  readString,
} from "@/convex/integrations/jsonBoundary"
import type { EventRound } from "@/convex/plugins/events/validators"

/**
 * Reads the public WCIF of an announced competition and returns the number of
 * rounds held for each event. Events without any rounds are omitted. Throws
 * when the competition is not publicly available (e.g. not yet announced).
 */
export async function fetchPublicCompetitionEventRounds(
  accessToken: string,
  wcaCompetitionId: string
): Promise<EventRound[]> {
  const response = await fetch(
    `${resolveWcaApiBaseUrl()}/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/wcif/public`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  )
  if (!response.ok) {
    throw new Error(
      `WCA public schedule lookup failed (HTTP ${String(response.status)}).`
    )
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("WCA public schedule returned an invalid response.")
  }
  const eventObjects = readObjectArray(body, "events") ?? []

  const rounds: EventRound[] = []
  const seen = new Set<string>()
  for (const event of eventObjects) {
    if (!isPlainObject(event)) {
      continue
    }
    const eventId = readString(event, "id")
    const roundObjects = readObjectArray(event, "rounds")
    if (eventId === undefined || roundObjects === undefined) {
      continue
    }
    if (roundObjects.length === 0 || seen.has(eventId)) {
      continue
    }
    seen.add(eventId)
    rounds.push({ eventId, rounds: roundObjects.length })
  }
  return rounds
}
