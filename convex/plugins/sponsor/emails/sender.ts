const DEFAULT_SPONSORSHIP_SENDER_ADDRESS = "sponsorship@speedcubingireland.com"

export function getSponsorshipSenderAddress(): string {
  const configured = process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim()
  if (configured !== undefined && configured.length > 0) {
    return configured
  }
  return DEFAULT_SPONSORSHIP_SENDER_ADDRESS
}
