import type { LocationRewrite } from "@tanstack/router-core"
import {
  internalPathToPublic,
  mapBrowserPathToInternal,
} from "@/lib/sponsor-site"

/**
 * TanStack Router rewrite for the sponsor portal origin.
 *
 * @see https://tanstack.com/router/latest/docs/guide/url-rewrites
 *
 * Internal route paths stay under `/sponsor/*` (file-based routes unchanged).
 * Browser URLs on the sponsor site use root paths (`/login`, `/auctions`, …).
 */
export function createSponsorSiteRewrite(): LocationRewrite {
  return {
    input: ({ url }) => {
      url.pathname = mapBrowserPathToInternal(url.pathname)
      return url
    },
    output: ({ url }) => {
      url.pathname = internalPathToPublic(url.pathname)
      return url
    },
  }
}
