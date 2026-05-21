import { render } from "@react-email/components"
import type { ReactElement } from "react"
import SponsorInviteEmail from "../emails/SponsorInviteEmail"
import SponsorshipAuctionActiveReminderEmail from "../emails/SponsorshipAuctionActiveReminderEmail"
import SponsorshipEbayAuctionOutbidEmail from "../emails/SponsorshipEbayAuctionOutbidEmail"
import SponsorshipInternalInvoiceEmail from "../emails/SponsorshipInternalInvoiceEmail"
import SponsorshipOutcomeEmail, {
  type SponsorshipOutcomeVariant,
} from "../emails/SponsorshipOutcomeEmail"
import SponsorshipScheduledEmail from "../emails/SponsorshipScheduledEmail"
import { sponsorPortalLoginUrl } from "../../lib/siteUrls"
import type { SponsorshipEmailType } from "./validators"

export type SponsorshipEmailContext = {
  competitionName?: string
  portalUrl?: string
  adminUrl?: string
  settlementAmountCents?: number
  winnerSponsorName?: string
  startsAt?: number
  endsAt?: number
  frameworkDescription?: string
  startPriceCents?: number
  currency?: string
  sponsorHasBid?: boolean
}

type BuildSponsorshipEmailInput = {
  emailType: SponsorshipEmailType
  recipientName?: string
  context?: SponsorshipEmailContext
  messageFallback: string
}

function resolveInviteTemplateData(
  context: SponsorshipEmailContext | undefined
): { portalUrl: string } {
  return {
    portalUrl: context?.portalUrl ?? sponsorPortalLoginUrl(),
  }
}

function resolveSponsorshipEmailTemplate(
  input: BuildSponsorshipEmailInput
): ReactElement | null {
  if (input.emailType === "invite") {
    const inviteData = resolveInviteTemplateData(input.context)
    return (
      <SponsorInviteEmail
        sponsorName={input.recipientName ?? "Sponsor"}
        portalUrl={inviteData.portalUrl}
      />
    )
  }

  if (input.emailType === "auction_scheduled") {
    if (input.context?.competitionName && input.context.portalUrl) {
      return (
        <SponsorshipScheduledEmail
          recipientName={input.recipientName}
          competitionName={input.context.competitionName}
          startsAt={input.context.startsAt}
          endsAt={input.context.endsAt}
          frameworkDescription={input.context.frameworkDescription}
          startPriceCents={input.context.startPriceCents}
          currency={input.context.currency}
          portalUrl={input.context.portalUrl}
        />
      )
    }
  }

  if (input.emailType === "auction_active_reminder") {
    if (
      input.context?.competitionName &&
      input.context.portalUrl &&
      input.context.endsAt !== undefined
    ) {
      return (
        <SponsorshipAuctionActiveReminderEmail
          recipientName={input.recipientName}
          competitionName={input.context.competitionName}
          endsAt={input.context.endsAt}
          portalUrl={input.context.portalUrl}
          sponsorHasBid={input.context.sponsorHasBid ?? false}
        />
      )
    }
  }

  if (input.emailType === "auction_ebay_outbid") {
    if (
      input.context?.competitionName &&
      input.context.portalUrl &&
      input.context.endsAt !== undefined
    ) {
      return (
        <SponsorshipEbayAuctionOutbidEmail
          recipientName={input.recipientName}
          competitionName={input.context.competitionName}
          endsAt={input.context.endsAt}
          portalUrl={input.context.portalUrl}
        />
      )
    }
  }

  if (
    input.emailType === "auction_started" ||
    input.emailType === "auction_closed_winner" ||
    input.emailType === "auction_closed_outbid" ||
    input.emailType === "auction_closed_none"
  ) {
    if (input.context?.competitionName && input.context.portalUrl) {
      return (
        <SponsorshipOutcomeEmail
          recipientName={input.recipientName}
          competitionName={input.context.competitionName}
          variant={input.emailType as SponsorshipOutcomeVariant}
          settlementAmountCents={input.context.settlementAmountCents}
          startsAt={input.context.startsAt}
          endsAt={input.context.endsAt}
          portalUrl={input.context.portalUrl}
        />
      )
    }
  }

  if (input.emailType === "internal_invoice") {
    if (input.context?.competitionName && input.context.adminUrl) {
      return (
        <SponsorshipInternalInvoiceEmail
          competitionName={input.context.competitionName}
          winnerSponsorName={input.context.winnerSponsorName}
          settlementAmountCents={input.context.settlementAmountCents}
          adminUrl={input.context.adminUrl}
          message={input.messageFallback}
        />
      )
    }
  }

  return null
}

async function buildSponsorshipEmail(
  input: BuildSponsorshipEmailInput,
  options: { plainText: boolean }
): Promise<string> {
  const template = resolveSponsorshipEmailTemplate(input)
  if (!template) {
    return options.plainText
      ? input.messageFallback
      : `<p>${input.messageFallback}</p>`
  }
  return options.plainText
    ? render(template, { plainText: true })
    : render(template)
}

export async function buildSponsorshipEmailHtml(
  input: BuildSponsorshipEmailInput
): Promise<string> {
  return buildSponsorshipEmail(input, { plainText: false })
}

export async function buildSponsorshipEmailPlainText(
  input: BuildSponsorshipEmailInput
): Promise<string> {
  return buildSponsorshipEmail(input, { plainText: true })
}
