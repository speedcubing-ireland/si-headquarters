export function impersonationTokenFromSearch(): string | null {
  if (typeof window === "undefined") {
    return null
  }
  const token = new URLSearchParams(window.location.search).get("token")?.trim()
  if (token === undefined || token.length === 0) {
    return null
  }
  return token
}
