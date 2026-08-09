const EXPIRING_SOON_MS = 15 * 60 * 1000

export type ServiceAccountStatus =
  | "disconnected"
  | "expired"
  | "expiring"
  | "healthy"

export function serviceAccountStatus(
  connected: boolean,
  expiresAtSeconds: number | null,
  nowMs: number
): ServiceAccountStatus {
  if (!connected || expiresAtSeconds === null) return "disconnected"
  const expiresAtMs = expiresAtSeconds * 1000
  if (expiresAtMs <= nowMs) return "expired"
  if (expiresAtMs <= nowMs + EXPIRING_SOON_MS) return "expiring"
  return "healthy"
}
