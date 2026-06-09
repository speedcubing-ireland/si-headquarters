import { env } from "@/convex/_generated/server"
import { resolveHqSiteBaseUrl } from "@/convex/urls"

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function resolveSponsorPortalBaseUrl(): string {
  return trimTrailingSlash(env.SPONSOR_SITE_URL)
}

export function resolveSponsorPortalBaseUrlForAuth(): string {
  return trimTrailingSlash(env.SPONSOR_SITE_URL)
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
  return `${resolveHqSiteBaseUrl()}/plugins/sponsorship`
}
