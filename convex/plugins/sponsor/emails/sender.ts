import { env } from "@/convex/_generated/server"

const DEFAULT_SPONSORSHIP_SENDER_ADDRESS = "sponsorship@speedcubingireland.com"

export function getSponsorshipSenderAddress(
  source: { SPONSORSHIP_EMAIL_SENDER_ADDRESS?: string | undefined } = env
): string {
  const configured = source.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim()
  if (configured !== undefined && configured.length > 0) {
    return configured
  }
  return DEFAULT_SPONSORSHIP_SENDER_ADDRESS
}
