export interface ParsedJsonRecord {
  [key: string]: ParsedJson
}

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
    // oxlint-disable-next-line typescript/consistent-type-assertions
    return JSON.parse(text) as ParsedJson
  } catch {
    return null
  }
}
