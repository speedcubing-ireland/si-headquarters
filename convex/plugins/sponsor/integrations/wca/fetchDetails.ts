"use node"

import { v } from "convex/values"
import { internalAction } from "@/convex/_generated/server"
import { WCA_BASE_URL } from "@/convex/plugins/wca/oauth"

const wcaCompetitionDetails = v.object({
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

interface WcaCompetitionDetails {
  id: string
  name: string
  city: string
  country_iso2: string
  start_date: string
  end_date: string
  event_ids: string[]
  competitor_limit: number | null
  venue: string
  venue_address?: string
  latitude_degrees?: number
  longitude_degrees?: number
}

function isPlainObject(
  value: object
): value is Record<string, object | string | number | boolean | null> {
  return !Array.isArray(value)
}

function readStringField(
  record: Record<string, object | string | number | boolean | null>,
  key: string
): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

function readNumberOrNullField(
  record: Record<string, object | string | number | boolean | null>,
  key: string
): number | null {
  const value = record[key]
  return typeof value === "number" ? value : null
}

function readOptionalNumberField(
  record: Record<string, object | string | number | boolean | null>,
  key: string
): number | undefined {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function readStringArrayField(
  record: Record<string, object | string | number | boolean | null>,
  key: string
): string[] | null {
  const value = record[key]
  if (!Array.isArray(value)) {
    return null
  }
  if (!value.every((item) => typeof item === "string")) {
    return null
  }
  return value
}

function parseWcaCompetitionDetails(
  value: object
): WcaCompetitionDetails | null {
  if (!isPlainObject(value)) {
    return null
  }

  const eventIds = readStringArrayField(value, "event_ids")
  if (eventIds === null) {
    return null
  }

  const id = readStringField(value, "id")
  const name = readStringField(value, "name")
  const city = readStringField(value, "city")
  const countryIso2 = readStringField(value, "country_iso2")
  const startDate = readStringField(value, "start_date")
  const endDate = readStringField(value, "end_date")
  const venue = readStringField(value, "venue")

  if (
    id === undefined ||
    name === undefined ||
    city === undefined ||
    countryIso2 === undefined ||
    startDate === undefined ||
    endDate === undefined ||
    venue === undefined
  ) {
    return null
  }

  const venueAddress = readStringField(value, "venue_address")
  const latitude = readOptionalNumberField(value, "latitude_degrees")
  const longitude = readOptionalNumberField(value, "longitude_degrees")

  return {
    id,
    name,
    city,
    country_iso2: countryIso2,
    start_date: startDate,
    end_date: endDate,
    event_ids: eventIds,
    competitor_limit: readNumberOrNullField(value, "competitor_limit"),
    venue,
    ...(venueAddress !== undefined ? { venue_address: venueAddress } : {}),
    ...(latitude !== undefined ? { latitude_degrees: latitude } : {}),
    ...(longitude !== undefined ? { longitude_degrees: longitude } : {}),
  }
}

export const fetchCompetitionDetailsInternal = internalAction({
  args: { wcaCompetitionId: v.string() },
  returns: v.union(wcaCompetitionDetails, v.null()),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${WCA_BASE_URL}/api/v0/competitions/${encodeURIComponent(args.wcaCompetitionId)}`,
      {
        headers: { Accept: "application/json" },
      }
    )
    if (!response.ok) {
      return null
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- fetch JSON boundary
    const body: object | null = await response.json()
    if (body === null || typeof body !== "object") {
      return null
    }
    return parseWcaCompetitionDetails(body)
  },
})
