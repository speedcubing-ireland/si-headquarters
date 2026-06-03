import { isParsedRecord, parseJson } from "@/lib/parsed-json"

const STORAGE_KEY = "hq-impersonation-consumption"

function readStoredEntry(
  raw: string
): { token?: string; nonce?: string } | null {
  const parsed = parseJson(raw)
  if (!isParsedRecord(parsed)) {
    return null
  }
  return {
    token: typeof parsed.token === "string" ? parsed.token : undefined,
    nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
  }
}

export function getOrCreateConsumptionNonce(token: string): string {
  if (token.length === 0 || typeof window === "undefined") {
    return crypto.randomUUID()
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw !== null && raw.length > 0) {
      const stored = readStoredEntry(raw)
      const nonce = stored?.nonce?.trim() ?? ""
      if (stored?.token === token && nonce.length >= 16) {
        return nonce
      }
    }
  } catch {
    // Ignore malformed storage values and regenerate.
  }

  const nonce = crypto.randomUUID()
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, nonce }))
  } catch {
    // Ignore storage failures; nonce still works in-memory.
  }
  return nonce
}

export function clearConsumptionNonce(token: string): void {
  if (token.length === 0 || typeof window === "undefined") {
    return
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw === null || raw.length === 0) {
      return
    }
    const stored = readStoredEntry(raw)
    if (stored?.token === token) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore cleanup failures.
  }
}
