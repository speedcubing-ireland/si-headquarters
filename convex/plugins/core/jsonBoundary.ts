export type JsonFieldValue = object | string | number | boolean | null
export type JsonRecord = Record<string, JsonFieldValue>
type JsonRoot = JsonFieldValue | JsonFieldValue[]
type JsonWireValue = JsonFieldValue | JsonWireValue[]

export function isPlainObject(value: object): value is JsonRecord {
  return !Array.isArray(value)
}

function isJsonFieldValue(value: JsonWireValue): value is JsonFieldValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    isPlainObject(value)
  )
}

function narrowJsonRoot(value: JsonWireValue): JsonRoot {
  if (Array.isArray(value)) {
    const items: JsonFieldValue[] = []
    for (const entry of value) {
      if (isJsonFieldValue(entry)) {
        items.push(entry)
      }
    }
    return items
  }
  if (isJsonFieldValue(value)) {
    return value
  }
  throw new Error("Invalid JSON root value")
}

function parseJsonText(text: string): JsonRoot {
  return narrowJsonRoot(JSON.parse(text) satisfies JsonWireValue)
}

async function readJson(response: Response): Promise<JsonRoot | null> {
  const text = await response.text()
  if (text.trim() === "") {
    return null
  }
  return parseJsonText(text)
}

export function readString(
  record: JsonRecord,
  key: string
): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

export function readNumber(
  record: JsonRecord,
  key: string
): number | undefined {
  const value = record[key]
  return typeof value === "number" ? value : undefined
}

export function readBoolean(
  record: JsonRecord,
  key: string
): boolean | undefined {
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

export function readRecord(
  record: JsonRecord,
  key: string
): JsonRecord | undefined {
  const value = record[key]
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return isPlainObject(value) ? value : undefined
  }
  return undefined
}

export function readObjectArray(
  record: JsonRecord,
  key: string
): object[] | undefined {
  const value = record[key]
  if (!Array.isArray(value)) {
    return undefined
  }
  return value.filter(
    (entry): entry is object =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  )
}

export async function readJsonObject(
  response: Response
): Promise<JsonRecord | null> {
  const body = await readJson(response)
  if (typeof body !== "object" || body === null || !isPlainObject(body)) {
    return null
  }
  return body
}

export async function readJsonObjectArray(
  response: Response
): Promise<object[]> {
  const body = await readJson(response)
  if (body === null || !Array.isArray(body)) {
    return []
  }
  const items: object[] = []
  for (const entry of body) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue
    }
    items.push(entry)
  }
  return items
}

export async function fetchJsonObject(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  errorLabel: string
): Promise<JsonRecord> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`${errorLabel} failed (HTTP ${String(response.status)}).`)
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error(`${errorLabel} returned an invalid response.`)
  }
  return body
}
