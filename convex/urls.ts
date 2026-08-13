import { env } from "@/convex/_generated/server"

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function resolveMainSiteBaseUrl(): string {
  return trimTrailingSlash(env.SITE_URL)
}

export function mainSiteUrl(path: string): string {
  return `${resolveMainSiteBaseUrl()}${path}`
}

// `localhost` and the loopback IPs are the same machine but different origins,
// and OAuth providers disagree about which one they accept in a redirect URI.
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

export function isLoopbackOrigin(origin: string): boolean {
  return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname)
}

/**
 * `mainSiteUrl`, but with the hostname swapped for `hostname` when the site is
 * served from a loopback origin. Canva rejects `localhost` redirect URIs and
 * only accepts `127.0.0.1`, while the WCA and Google OAuth apps have `localhost`
 * registered — so local development needs a different host per provider even
 * though `SITE_URL` is a single value. Deployed origins are never loopback, so
 * this is inert outside local development.
 */
export function loopbackAwareMainSiteUrl(
  path: string,
  hostname: string | undefined
): string {
  const base = resolveMainSiteBaseUrl()
  if (hostname === undefined || !isLoopbackOrigin(base)) {
    return `${base}${path}`
  }
  const url = new URL(base)
  url.hostname = hostname
  return `${url.origin}${path}`
}
