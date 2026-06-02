import { env } from "@/convex/_generated/server"

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

export function resolveHqSiteBaseUrl(): string {
  return trimTrailingSlash(env.SITE_URL ?? "https://hq.speedcubingireland.com")
}

export function resolveSponsorPortalBaseUrl(): string {
  return trimTrailingSlash(
    env.SPONSOR_SITE_URL ??
      env.SITE_URL ??
      "https://sponsors.speedcubingireland.com"
  )
}

export function resolveSponsorPortalBaseUrlForAuth(): string {
  return trimTrailingSlash(
    env.SPONSOR_SITE_URL ??
      env.SITE_URL ??
      env.VITE_SITE_URL ??
      (process.env.NODE_ENV === "production"
        ? "https://sponsors.speedcubingireland.com"
        : "http://localhost:5174")
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

export function sponsorshipAdminPageUrl(): string {
  return `${resolveHqSiteBaseUrl()}/admin/sponsorship`
}
