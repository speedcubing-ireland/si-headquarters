import { api } from "@/convex/_generated/api"
import { convex } from "@/lib/convex-client"

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Providers disagree about which loopback host they accept in a redirect URI —
 * Canva only takes `127.0.0.1`, WCA and Google have `localhost` registered — so
 * in local development the browser can land on the callback at an origin the
 * director is not signed in on (auth state is per-origin). Move to the `SITE_URL`
 * origin, carrying `code` and `state`, before anything tries to authenticate.
 *
 * Only hops away from a loopback origin, so a misconfigured deployment can never
 * bounce real users off the site they arrived on.
 */
export async function ensureCanonicalCallbackOrigin(): Promise<void> {
  const current = new URL(window.location.href)
  if (!LOOPBACK_HOSTNAMES.has(current.hostname)) {
    return
  }
  const canonical = new URL(
    await convex.query(
      api.integrations.serviceAccountConnect.callbackSiteOrigin,
      {}
    )
  )
  if (current.origin === canonical.origin) {
    return
  }
  current.protocol = canonical.protocol
  current.host = canonical.host
  window.location.replace(current.toString())
}
