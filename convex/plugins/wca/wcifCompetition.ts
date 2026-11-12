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
  readNumber,
  readObjectArray,
  readRecord,
  readString,
  tryParseJsonObject,
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
): Promise<
  { success: true } | { success: false; status: number; error: string }
> {
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
    return {
      success: false,
      status: response.status,
      error: `WCA rejected the WCIF update (HTTP ${String(response.status)}): ${describeWcaErrorBody(await response.text())}`,
    }
  }
  return { success: true }
}

const MAX_ERROR_DETAIL_LENGTH = 500

/**
 * A readable reason from a WCA error response. The WCA reports WCIF failures
 * as `{ "error": "..." }`, but proxies and outages can return HTML or plain
 * text instead, which must not crash the caller or flood the UI.
 */
export function describeWcaErrorBody(text: string): string {
  const trimmed = text.trim()
  if (trimmed === "") {
    return "no details given"
  }
  const body = tryParseJsonObject(trimmed)
  let detail: string
  if (body !== null) {
    detail = readString(body, "error") ?? JSON.stringify(body)
  } else if (trimmed.startsWith("<")) {
    return "the WCA returned an unexpected HTML page"
  } else {
    detail = trimmed
  }
  return detail.length > MAX_ERROR_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`
    : detail
}
