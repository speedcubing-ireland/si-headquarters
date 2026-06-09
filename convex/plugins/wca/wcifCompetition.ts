import type {
  WcifEvent,
  WcifPerson,
  WcifSchedule as Schedule,
  WcifVenue,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import { resolveWcaApiBaseUrl } from "@/convex/deploymentContext"
import {
  isPlainObject,
  type JsonRecord,
  readJsonObject,
  readNumber,
  readObjectArray,
  readRecord,
  readString,
} from "@/convex/integrations/jsonBoundary"
import type { WcaClient } from "@/convex/plugins/wca/client"
import { getCompetitionWcif } from "@/convex/plugins/wca/openapiClient/sdk.gen"

export interface CompetitionWcif {
  id: string
  events: WcifEvent[]
  schedule: Schedule
  persons?: WcifPerson[]
}

function isWcifEvent(value: object): value is WcifEvent {
  if (!isPlainObject(value)) {
    return false
  }
  return (
    readString(value, "id") !== undefined &&
    readObjectArray(value, "rounds") !== undefined
  )
}

function isWcifVenue(value: object): value is WcifVenue {
  if (!isPlainObject(value)) {
    return false
  }
  return (
    readNumber(value, "id") !== undefined &&
    readString(value, "name") !== undefined &&
    readObjectArray(value, "rooms") !== undefined
  )
}

export function parseWcifSchedule(record: JsonRecord): Schedule | null {
  const startDate = readString(record, "startDate")
  const numberOfDays = readNumber(record, "numberOfDays")
  const venueObjects = readObjectArray(record, "venues")
  if (
    startDate === undefined ||
    numberOfDays === undefined ||
    venueObjects === undefined
  ) {
    return null
  }
  const venues = venueObjects.filter(isWcifVenue)
  if (venues.length !== venueObjects.length) {
    return null
  }
  return { startDate, numberOfDays, venues }
}

export function parseCompetitionWcif(data: object): CompetitionWcif | null {
  if (!isPlainObject(data)) {
    return null
  }
  const id = readString(data, "id")
  const eventObjects = readObjectArray(data, "events")
  const scheduleRecord = readRecord(data, "schedule")
  if (
    id === undefined ||
    eventObjects === undefined ||
    scheduleRecord === undefined
  ) {
    return null
  }
  const events = eventObjects.filter(isWcifEvent)
  if (events.length !== eventObjects.length) {
    return null
  }
  const schedule = parseWcifSchedule(scheduleRecord)
  if (schedule === null) {
    return null
  }
  const personObjects = readObjectArray(data, "persons")
  const persons =
    personObjects === undefined
      ? undefined
      : personObjects.filter((person): person is WcifPerson =>
          isPlainObject(person)
        )
  return { id, events, schedule, persons }
}

export async function loadCompetitionWcif(
  client: WcaClient,
  competitionId: string
): Promise<CompetitionWcif | null> {
  const response = await getCompetitionWcif({
    client,
    path: { competitionId },
  })
  if (response.error !== undefined || response.data === undefined) {
    return null
  }
  return parseCompetitionWcif(response.data)
}

export async function patchCompetitionWcif(
  accessToken: string,
  competitionId: string,
  payload: Pick<CompetitionWcif, "id" | "events" | "schedule">
): Promise<{ success: true } | { success: false; error: string }> {
  const response = await fetch(
    `${resolveWcaApiBaseUrl()}/v0/competitions/${encodeURIComponent(competitionId)}/wcif`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )
  if (!response.ok) {
    const errorBody = await readJsonObject(response)
    return {
      success: false,
      error: `WCA rejected WCIF update (HTTP ${String(response.status)}): ${JSON.stringify(errorBody)}`,
    }
  }
  return { success: true }
}
