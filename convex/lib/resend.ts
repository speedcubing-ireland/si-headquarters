import { Resend } from "@convex-dev/resend"
import { components } from "../_generated/api"

const DEFAULT_SPONSORSHIP_SENDER_ADDRESS = "sponsorship@speedcubingireland.com"

export const resend = new Resend(components.resend, {
  testMode: false,
})

export function getSponsorshipSenderAddress(): string {
  return (
    process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS?.trim() ||
    DEFAULT_SPONSORSHIP_SENDER_ADDRESS
  )
}
