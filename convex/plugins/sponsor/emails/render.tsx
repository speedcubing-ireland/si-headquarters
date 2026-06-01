import { render } from "@react-email/components"
import type { ReactElement } from "react"
import type { SponsorPortalOtpEmailProps } from "@/convex/plugins/sponsor/lib/validators"
import type { SponsorshipEmailType } from "@/convex/plugins/sponsor/lib/validators"
import { buildElement as buildAuctionActiveReminder } from "./auction_active_reminder"
import { buildElement as buildAuctionClosedNone } from "./auction_closed_none"
import { buildElement as buildAuctionClosedOutbid } from "./auction_closed_outbid"
import { buildElement as buildAuctionClosedWinner } from "./auction_closed_winner"
import { buildElement as buildAuctionEbayOutbid } from "./auction_ebay_outbid"
import { buildElement as buildAuctionScheduled } from "./auction_scheduled"
import { buildElement as buildAuctionStarted } from "./auction_started"
import { buildElement as buildInternalInvoice } from "./internal_invoice_winner"
import { buildElement as buildInvite } from "./invite"
import OtpSignInEmail from "./otp_sign_in"
import type { BuildEmailInput, EmailBuildElement } from "./_build"

export type { BuildEmailInput } from "./_build"
export type { SponsorshipEmailContext } from "@/convex/plugins/sponsor/lib/validators"

const BUILDERS: Record<SponsorshipEmailType, EmailBuildElement> = {
  invite: buildInvite,
  auction_scheduled: buildAuctionScheduled,
  auction_started: buildAuctionStarted,
  auction_active_reminder: buildAuctionActiveReminder,
  auction_ebay_outbid: buildAuctionEbayOutbid,
  auction_closed_winner: buildAuctionClosedWinner,
  auction_closed_outbid: buildAuctionClosedOutbid,
  auction_closed_none: buildAuctionClosedNone,
  internal_invoice: buildInternalInvoice,
}

function emailElement(input: BuildEmailInput): ReactElement | null {
  return BUILDERS[input.emailType](input)
}

function fallbackBody(
  input: BuildEmailInput,
  plainText: boolean | undefined,
): string {
  return plainText === true
    ? input.messageFallback
    : `<p>${input.messageFallback}</p>`
}

async function renderBuiltEmail(
  input: BuildEmailInput,
  options?: { plainText?: boolean },
): Promise<string> {
  const element = emailElement(input)
  if (element === null) {
    return fallbackBody(input, options?.plainText)
  }
  return render(element, options)
}

async function renderBothFormats(element: ReactElement): Promise<{
  html: string
  plainText: string
}> {
  const [html, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { html, plainText }
}

export function buildSponsorshipEmailHtml(
  input: BuildEmailInput,
): Promise<string> {
  return renderBuiltEmail(input)
}

export function buildSponsorshipEmailPlainText(
  input: BuildEmailInput,
): Promise<string> {
  return renderBuiltEmail(input, { plainText: true })
}

export function buildSponsorPortalOtpEmail(
  props: SponsorPortalOtpEmailProps,
): Promise<{ html: string; plainText: string }> {
  return renderBothFormats(<OtpSignInEmail {...props} />)
}
