import { env } from "@/env"
import { resolveIsSponsorSite } from "@/lib/sponsor-site"

/** HQ admin UI is gated by `VITE_SPONSORSHIP_ENABLED`; the sponsor portal origin is always on. */
export const isSponsorshipEnabled =
  env.VITE_SPONSORSHIP_ENABLED || resolveIsSponsorSite()
