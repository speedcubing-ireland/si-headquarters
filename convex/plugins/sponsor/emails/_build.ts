import { sponsorPortalLoginUrl } from "@/convex/plugins/sponsor/siteUrls"
import type {
  SponsorshipEmailContext,
  SponsorshipEmailType,
  SponsorshipLifecycleEmailType,
  SponsorshipOutcomeEmailType,
} from "@/convex/plugins/sponsor/lib/validators"
import type { ReactElement } from "react"
import type { InternalInvoiceEmailProps } from "./_components/internal_invoice_email"
import type { LifecycleEmailProps } from "./_components/lifecycle_email"
import type { OutcomeEmailProps } from "./_components/outcome_email"

export interface BuildEmailInput {
  emailType: SponsorshipEmailType
  recipientName?: string
  context?: SponsorshipEmailContext
  messageFallback: string
}

export type EmailBuildElement = (input: BuildEmailInput) => ReactElement | null

export interface InviteEmailProps {
  sponsorName: string
  portalUrl: string
}

type PortalContext = SponsorshipEmailContext & {
  competitionName: string
  portalUrl: string
}

type PortalContextWithEnd = PortalContext & { endsAt: number }

type InvoiceContext = SponsorshipEmailContext & {
  competitionName: string
  adminUrl: string
}

function nonEmptyString(value: string | undefined): value is string {
  return (value?.length ?? 0) > 0
}

function portalContext(
  context: SponsorshipEmailContext | undefined
): PortalContext | null {
  if (
    !context ||
    !nonEmptyString(context.competitionName) ||
    !nonEmptyString(context.portalUrl)
  ) {
    return null
  }
  return {
    ...context,
    competitionName: context.competitionName,
    portalUrl: context.portalUrl,
  }
}

function portalContextWithEnd(
  context: SponsorshipEmailContext | undefined
): PortalContextWithEnd | null {
  const portal = portalContext(context)
  if (!portal || context?.endsAt === undefined) {
    return null
  }
  return { ...portal, endsAt: context.endsAt }
}

function invoiceContext(
  context: SponsorshipEmailContext | undefined
): InvoiceContext | null {
  if (
    !context ||
    !nonEmptyString(context.competitionName) ||
    !nonEmptyString(context.adminUrl)
  ) {
    return null
  }
  return {
    ...context,
    competitionName: context.competitionName,
    adminUrl: context.adminUrl,
  }
}

function lifecyclePortalContext(
  emailType: SponsorshipLifecycleEmailType,
  context: SponsorshipEmailContext | undefined
): PortalContext | PortalContextWithEnd | null {
  return emailType === "auction_scheduled"
    ? portalContext(context)
    : portalContextWithEnd(context)
}

export function buildInviteProps(input: BuildEmailInput): InviteEmailProps {
  return {
    sponsorName: input.recipientName ?? "Sponsor",
    portalUrl: input.context?.portalUrl ?? sponsorPortalLoginUrl(),
  }
}

export function buildLifecycleProps(
  variant: SponsorshipLifecycleEmailType,
  input: BuildEmailInput
): LifecycleEmailProps | null {
  const lifecyclePortal = lifecyclePortalContext(variant, input.context)
  if (!lifecyclePortal) return null

  return {
    variant,
    recipientName: input.recipientName,
    competitionName: lifecyclePortal.competitionName,
    portalUrl: lifecyclePortal.portalUrl,
    startsAt: input.context?.startsAt,
    endsAt: input.context?.endsAt,
    frameworkDescription: input.context?.frameworkDescription,
    startPriceCents: input.context?.startPriceCents,
    currency: input.context?.currency,
    sponsorHasBid: input.context?.sponsorHasBid,
  }
}

export function buildOutcomeProps(
  variant: SponsorshipOutcomeEmailType,
  input: BuildEmailInput
): OutcomeEmailProps | null {
  const portal = portalContext(input.context)
  if (!portal) return null

  return {
    variant,
    recipientName: input.recipientName,
    competitionName: portal.competitionName,
    portalUrl: portal.portalUrl,
    settlementAmountCents: input.context?.settlementAmountCents,
    startsAt: input.context?.startsAt,
    endsAt: input.context?.endsAt,
  }
}

export function buildInternalInvoiceProps(
  input: BuildEmailInput
): InternalInvoiceEmailProps | null {
  const invoice = invoiceContext(input.context)
  if (!invoice) return null

  return {
    ...invoice,
    message: input.messageFallback,
  }
}
