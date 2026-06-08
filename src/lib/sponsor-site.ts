import { env } from "@/env"

const SPONSOR_PRODUCTION_HOST = "sponsors.speedcubingireland.com"
const SPONSOR_DEV_PORT = "5174"

export const SPONSOR_NOT_FOUND_PATH = "/sponsor/404"

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "")
  return trimmed.length > 0 ? trimmed : "/"
}

export function resolveIsSponsorSite(): boolean {
  if (env.VITE_SPONSOR_SITE) {
    return true
  }

  if (typeof window === "undefined") {
    return false
  }

  const { hostname, port } = window.location
  return (
    hostname === SPONSOR_PRODUCTION_HOST ||
    (hostname === "localhost" && port === SPONSOR_DEV_PORT)
  )
}

export function isSponsorSite(): boolean {
  return resolveIsSponsorSite()
}

export function isSponsorPublicPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname)
  if (normalized === "/") return true
  if (normalized === "/login") return true
  if (normalized === "/guide") return true
  if (normalized === "/impersonate") return true
  if (normalized === "/settings") return true
  if (normalized === "/auctions") return true
  if (normalized === "/404") return true
  return /^\/auctions\/[^/]+$/.test(normalized)
}

export function publicPathToInternal(pathname: string): string {
  const normalized = normalizePathname(pathname)

  if (normalized.startsWith("/sponsor")) {
    return normalized === "/sponsor" ? "/sponsor/" : normalized
  }

  switch (normalized) {
    case "/":
      return "/sponsor/"
    case "/login":
      return "/sponsor/login"
    case "/guide":
      return "/sponsor/guide"
    case "/impersonate":
      return "/sponsor/impersonate"
    case "/settings":
      return "/sponsor/settings"
    case "/auctions":
      return "/sponsor/auctions"
    case "/404":
      return SPONSOR_NOT_FOUND_PATH
    default: {
      const auctionMatch = /^\/auctions\/([^/]+)$/.exec(normalized)
      if (auctionMatch) {
        return `/sponsor/auctions/${auctionMatch[1]}`
      }
      return SPONSOR_NOT_FOUND_PATH
    }
  }
}

export function internalPathToPublic(pathname: string): string {
  const normalized = normalizePathname(pathname)

  if (normalized === SPONSOR_NOT_FOUND_PATH) {
    return "/404"
  }

  if (!normalized.startsWith("/sponsor")) {
    return normalized
  }

  if (normalized === "/sponsor" || normalized === "/sponsor/") {
    return "/"
  }

  const suffix = normalized.slice("/sponsor".length)
  return suffix.length > 0 ? suffix : "/"
}

export function mapBrowserPathToInternal(pathname: string): string {
  if (isSponsorPublicPath(pathname) || pathname.startsWith("/sponsor")) {
    return publicPathToInternal(pathname)
  }
  return SPONSOR_NOT_FOUND_PATH
}
