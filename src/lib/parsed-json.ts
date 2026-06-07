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
    // JSON.parse is typed as any; keep the boundary assertion in one place.
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return JSON.parse(text) as ParsedJson
  } catch {
    return null
  }
}
