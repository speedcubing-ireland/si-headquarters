import { env } from "@/convex/_generated/server"
import { organisationConfig } from "@/config/lib/organisation"

const DEFAULT_SPONSORSHIP_SENDER_ADDRESS =
  organisationConfig.contacts.sponsorshipTeamEmail

export function getSponsorshipSenderAddress(
  source: { SPONSORSHIP_EMAIL_SENDER_ADDRESS?: string | undefined } = env
): string {
  const configured = source.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim()
  if (configured !== undefined && configured.length > 0) {
    return configured
  }
  return DEFAULT_SPONSORSHIP_SENDER_ADDRESS
}
