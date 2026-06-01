import type { HttpRouter } from "convex/server"
import { betterAuth } from "better-auth"
import {
  createSponsorAuthOptions,
  sponsorAuthComponent,
} from "@/convex/plugins/sponsor/auth/server"

function normalizeOrigin(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  try {
    return new URL(trimmed).origin
  } catch {
    return undefined
  }
}

function parseOriginList(value: string | undefined): string[] {
  if (value === undefined) {
    return []
  }
  return value
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => entry !== undefined)
}

export function sponsorAuthAllowedOrigins(): string[] {
  return Array.from(
    new Set(
      [
        normalizeOrigin(process.env.SITE_URL),
        normalizeOrigin(process.env.SPONSOR_SITE_URL),
        normalizeOrigin(process.env.VITE_SITE_URL),
        ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
        "http://localhost:5173",
        "http://localhost:5174",
      ].filter((origin): origin is string => origin !== undefined),
    ),
  )
}

export function registerSponsorHttpRoutes(http: HttpRouter): void {
  sponsorAuthComponent.registerRoutes(
    http,
    (ctx) =>
      betterAuth(
        createSponsorAuthOptions(ctx, { requireConfiguredSecret: false }),
      ),
    {
      cors: {
        allowedOrigins: sponsorAuthAllowedOrigins(),
      },
    },
  )
}
