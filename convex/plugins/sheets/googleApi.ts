"use node"

import {
  isPlainObject,
  readJsonObject,
  readObjectArray,
  readRecord,
  readString,
  type JsonRecord,
} from "@/convex/integrations/jsonBoundary"
import {
  SCHEDULE_RANGES,
  type ScheduleReadResult,
} from "@/convex/plugins/sheets/schedule"

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

export async function fetchSpreadsheetTitle(
  accessToken: string,
  sheetId: string
): Promise<{ title: string; url: string }> {
  const response = await fetch(
    `${SHEETS_API}/${sheetId}?fields=spreadsheetUrl,properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!response.ok) {
    throw new Error(
      `Google Sheets lookup failed (HTTP ${String(response.status)}).`
    )
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
    throw new Error(
      `Google Sheets read failed (HTTP ${String(response.status)}).`
    )
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
      result[range] = matrixFromValueRange(entry) ?? []
    }
  }
  return result
}

export async function fetchSchedule(
  accessToken: string,
  sheetId: string
): Promise<ScheduleReadResult> {
  const ranges = [
    SCHEDULE_RANGES.saturday,
    SCHEDULE_RANGES.sunday,
    SCHEDULE_RANGES.progression,
  ]
  const data = await readSheetRanges(accessToken, sheetId, ranges)
  return {
    saturday: data[SCHEDULE_RANGES.saturday] ?? [],
    sunday: data[SCHEDULE_RANGES.sunday] ?? [],
    progression: data[SCHEDULE_RANGES.progression] ?? [],
  }
}

export async function fetchScheduleProgression(
  accessToken: string,
  sheetId: string
): Promise<string[][]> {
  const data = await readSheetRanges(accessToken, sheetId, [
    SCHEDULE_RANGES.progression,
  ])
  return data[SCHEDULE_RANGES.progression] ?? []
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
    throw new Error(
      `Google Sheets clear failed (HTTP ${String(response.status)}).`
    )
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
    throw new Error(
      `Google Sheets write failed (HTTP ${String(response.status)}).`
    )
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
    const suffix = detail.length > 0 ? `: ${detail.slice(0, 200)}` : ""
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
