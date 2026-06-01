/** Parsed JSON object from localStorage / saved views (interface avoids circular alias). */
export interface ParsedJsonRecord {
  [key: string]: ParsedJson
}

/** Parsed JSON values from localStorage / saved views. */
export type ParsedJson =
  | null
  | boolean
  | number
  | string
  | ParsedJson[]
  | ParsedJsonRecord

export function isParsedRecord(value: ParsedJson): value is ParsedJsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseJson(text: string): ParsedJson | null {
  try {
    return JSON.parse(text) as ParsedJson
  } catch {
    return null
  }
}
