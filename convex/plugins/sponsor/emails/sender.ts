import { env } from "@/convex/_generated/server"
import { sponsorshipConfig } from "@/config/lib/organisation"

export function getSponsorshipSenderAddress(
  source: { SPONSORSHIP_EMAIL_SENDER_ADDRESS?: string | undefined } = env
): string {
  const configured = source.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim()
  if (configured !== undefined && configured.length > 0) {
    return configured
  }
  return sponsorshipConfig().contacts.sponsorshipTeamEmail
}
