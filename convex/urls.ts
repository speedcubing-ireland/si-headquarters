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
