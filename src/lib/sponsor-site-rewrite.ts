import type { LocationRewrite } from "@tanstack/router-core"
import {
  internalPathToPublic,
  mapBrowserPathToInternal,
} from "@/lib/sponsor-site"

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
