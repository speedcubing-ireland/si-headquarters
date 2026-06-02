"use node"

import {
  isPlainObject,
  readJsonObject,
  readObjectArray,
  readRecord,
  readString,
  type JsonRecord,
} from "@/convex/plugins/core/jsonBoundary"
import {
  SCHEDULE_CACHE_TTL_MS,
  SCHEDULE_RANGES,
  type ScheduleReadResult,
  parseSheetValues,
} from "@/convex/plugins/sheets/schedule"

const scheduleCache = new Map<
  string,
  { expiresAt: number; value: ScheduleReadResult }
>()

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

export async function fetchSpreadsheetTitle(
  accessToken: string,
  sheetId: string
): Promise<{ title: string; url: string }> {
  const response = await fetch(`${SHEETS_API}/${sheetId}?fields=spreadsheetUrl,properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Google Sheets lookup failed (HTTP ${String(response.status)}).`)
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("Google Sheets lookup returned an invalid response.")
  }
  const properties = readRecord(body, "properties")
  const title =
    properties !== undefined
      ? (readString(properties, "title") ?? sheetId)
      : sheetId
  const url =
    readString(body, "spreadsheetUrl") ??
    `https://docs.google.com/spreadsheets/d/${sheetId}`
  return { title, url }
}

export async function readSheetRanges(
  accessToken: string,
  sheetId: string,
  ranges: readonly string[]
): Promise<Record<string, string[][]>> {
  const params = new URLSearchParams()
  for (const range of ranges) {
    params.append("ranges", range)
  }
  const response = await fetch(
    `${SHEETS_API}/${sheetId}/values:batchGet?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) {
    throw new Error(`Google Sheets read failed (HTTP ${String(response.status)}).`)
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("Google Sheets read returned an invalid response.")
  }
  const valueRanges = readObjectArray(body, "valueRanges") ?? []
  const result: Record<string, string[][]> = {}
  for (const entry of valueRanges) {
    if (!isPlainObject(entry)) {
      continue
    }
    const range = readString(entry, "range")
    if (range !== undefined) {
      result[range] = parseSheetValues(matrixFromValueRange(entry))
    }
  }
  return result
}

export async function readSchedule(
  accessToken: string,
  sheetId: string
): Promise<ScheduleReadResult> {
  const cacheKey = sheetId
  const cached = scheduleCache.get(cacheKey)
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const ranges = [
    SCHEDULE_RANGES.groupBlocks,
    SCHEDULE_RANGES.eventBlocks,
    SCHEDULE_RANGES.progression,
  ]
  const data = await readSheetRanges(accessToken, sheetId, ranges)
  const value = {
    groupBlocks: data[SCHEDULE_RANGES.groupBlocks] ?? [],
    eventBlocks: data[SCHEDULE_RANGES.eventBlocks] ?? [],
    progression: data[SCHEDULE_RANGES.progression] ?? [],
  }
  scheduleCache.set(cacheKey, {
    expiresAt: Date.now() + SCHEDULE_CACHE_TTL_MS,
    value,
  })
  return value
}

export async function clearSheetRange(
  accessToken: string,
  sheetId: string,
  range: string
): Promise<void> {
  const response = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!response.ok) {
    throw new Error(`Google Sheets clear failed (HTTP ${String(response.status)}).`)
  }
}

export async function writeSheetRange(
  accessToken: string,
  sheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const response = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  )
  if (!response.ok) {
    throw new Error(`Google Sheets write failed (HTTP ${String(response.status)}).`)
  }
}

export async function shareSheetWithEmail(
  accessToken: string,
  sheetId: string,
  email: string
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: email,
        sendNotificationEmail: false,
      }),
    }
  )
  if (!response.ok && response.status !== 409) {
    const detail = await response.text()
    const suffix =
      detail.length > 0 ? `: ${detail.slice(0, 200)}` : ""
    throw new Error(
      `Google Drive share failed (HTTP ${String(response.status)}${suffix}).`
    )
  }
}

function matrixFromValueRange(entry: JsonRecord): string[][] | undefined {
  const values = entry.values
  if (!Array.isArray(values)) {
    return undefined
  }
  const rows: string[][] = []
  for (const row of values) {
    if (!Array.isArray(row)) {
      continue
    }
    rows.push(
      row.map((cell) => (typeof cell === "string" ? cell : String(cell)))
    )
  }
  return rows
}
