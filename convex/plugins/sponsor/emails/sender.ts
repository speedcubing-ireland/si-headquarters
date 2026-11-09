import type { QueryCtx } from "@/convex/_generated/server"
import {
  configuredSponsorshipSenderAddress,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { sponsorshipSenderOverride } from "@/convex/settings/model"

/**
 * The manifest's sponsorship team, as `Name <address>`, used when Admin →
 * Settings has no sender override. Null when the sponsors feature is off.
 */
export function defaultSponsorshipSenderAddress(): string | null {
  if (!isFeatureEnabled("sponsors")) return null
  return configuredSponsorshipSenderAddress()
}

/** Throws (via the manifest) when the sponsors feature is off. */
export async function getSponsorshipSenderAddress(
  ctx: QueryCtx
): Promise<string> {
  return (
    (await sponsorshipSenderOverride(ctx)) ??
    configuredSponsorshipSenderAddress()
  )
}
