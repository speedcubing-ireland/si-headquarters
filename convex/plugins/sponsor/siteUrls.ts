import { requireConvexEnv } from "@/convex/envTypes"
import { resolveMainSiteBaseUrl } from "@/convex/urls"

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function resolveSponsorPortalBaseUrl(): string {
  return trimTrailingSlash(
    requireConvexEnv(
      "SPONSOR_SITE_URL",
      "Sponsor portal URLs require SPONSOR_SITE_URL to be set."
    )
  )
}

export function resolveSponsorPortalBaseUrlForAuth(): string {
  return trimTrailingSlash(
    requireConvexEnv(
      "SPONSOR_SITE_URL",
      "Sponsor auth requires SPONSOR_SITE_URL to be set."
    )
  )
}

export function resolveSponsorPortalOriginForAuth(): string {
  return new URL(resolveSponsorPortalBaseUrlForAuth()).origin
}

export function sponsorPortalLoginUrl(): string {
  return `${resolveSponsorPortalBaseUrl()}/login`
}

export function sponsorPortalAuctionUrl(auctionId: string): string {
  return `${resolveSponsorPortalBaseUrl()}/auctions/${auctionId}`
}

export function sponsorPortalAuctionsIndexUrl(): string {
  return `${resolveSponsorPortalBaseUrl()}/auctions`
}

export function sponsorPortalGuideUrl(): string {
  return `${resolveSponsorPortalBaseUrl()}/guide`
}

export function sponsorshipAdminPageUrl(): string {
  return `${resolveMainSiteBaseUrl()}/plugins/sponsorship`
}
