import type { QueryCtx } from "@/convex/_generated/server"
import { isFeatureEnabled, sponsorshipConfig } from "@/config/lib/organisation"
import { configuredSponsorshipSenderAddress } from "@/convex/settings/model"

/**
 * The manifest's sponsorship team address, used when Admin → Settings has no
 * sender override. Null when the sponsors feature is off.
 */
export function defaultSponsorshipSenderAddress(): string | null {
  if (!isFeatureEnabled("sponsors")) return null
  return sponsorshipConfig().contacts.sponsorshipTeamEmail
}

export async function getSponsorshipSenderAddress(
  ctx: QueryCtx
): Promise<string> {
  const configured = await configuredSponsorshipSenderAddress(ctx)
  if (configured !== null) return configured
  return sponsorshipConfig().contacts.sponsorshipTeamEmail
}
