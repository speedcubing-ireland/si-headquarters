import { auctionFrameworkLabel } from "@/convex/plugins/sponsor/lib/types"
import type {
  SponsorOtpAuthType,
  SponsorPortalOtpPurpose,
  SponsorshipEmailType,
  SponsorshipOutcomeEmailType,
} from "@/convex/plugins/sponsor/lib/validators"
import {
  formatEmailDateTime,
  formatMoney,
  formatRecipientSubtitle,
} from "./_design"
import type { EmailCopyContext, EmailInfoRow, EmailTemplateCopy } from "./types"
import {
  organisationConfig,
  sponsorshipConfig,
} from "@/config/lib/organisation"

export type { EmailCopyContext, EmailInfoRow, EmailTemplateCopy }
export type { SponsorOtpAuthType, SponsorPortalOtpPurpose }

export const ANTI_SNIPING_FOOTNOTE =
  "Note: anti-sniping rules may extend the closing time if a bid is placed in the final minutes."

const PORTAL_REVISIT_FOOTNOTE =
  "You can revisit this auction at any time in the sponsor portal."

const SCHEDULED_PORTAL_FOOTNOTE =
  "You will receive another email when bidding opens. You can also check the sponsor portal at any time."

const productName = organisationConfig.organisation.productName

function competitionName(ctx: EmailCopyContext): string {
  return ctx.competitionName ?? "the competition"
}

function lifecycleScheduledCopy(ctx: EmailCopyContext): EmailTemplateCopy {
  const { sponsorship } = sponsorshipConfig()
  const name = competitionName(ctx)
  const currency = ctx.currency ?? sponsorship.defaultCurrency
  const subtitle = formatRecipientSubtitle(
    ctx.recipientName,
    (recipient) =>
      ctx.startsAt !== undefined
        ? `Hi ${recipient}, bidding for ${name} sponsorship will open on ${formatEmailDateTime(ctx.startsAt)}.`
        : `Hi ${recipient}, bidding for ${name} sponsorship will open soon.`,
    ctx.startsAt !== undefined
      ? `Bidding for ${name} sponsorship will open on ${formatEmailDateTime(ctx.startsAt)}.`
      : `Bidding for ${name} sponsorship will open soon.`
  )

  const infoRows: EmailInfoRow[] = [{ label: "Competition", value: name }]
  if (ctx.startsAt !== undefined) {
    infoRows.push({
      label: "Bidding opens",
      value: formatEmailDateTime(ctx.startsAt),
    })
  }
  if (ctx.endsAt !== undefined) {
    infoRows.push({
      label: "Bidding closes",
      value: formatEmailDateTime(ctx.endsAt),
    })
  }
  if (ctx.framework !== undefined) {
    infoRows.push({
      label: "Auction format",
      value: auctionFrameworkLabel(ctx.framework),
      ...(ctx.frameworkGuideUrl !== undefined &&
      ctx.frameworkGuideUrl.length > 0
        ? { valueHref: ctx.frameworkGuideUrl }
        : {}),
    })
  } else if (
    ctx.frameworkDescription !== undefined &&
    ctx.frameworkDescription.length > 0
  ) {
    infoRows.push({
      label: "Auction format",
      value: ctx.frameworkDescription,
    })
  }
  if (ctx.startPriceCents !== undefined) {
    infoRows.push({
      label: "Starting price",
      value: formatMoney(ctx.startPriceCents, currency),
    })
  }

  return {
    preview: `${name}: bidding opening soon`,
    title: `${name}: bidding opening soon`,
    subtitle,
    ctaLabel: "View in portal",
    infoRows,
    bodyParagraphs: [],
    footnoteParagraphs: [SCHEDULED_PORTAL_FOOTNOTE],
    showAntiSnipingNote: false,
  }
}

function lifecycleActiveReminderCopy(ctx: EmailCopyContext): EmailTemplateCopy {
  const name = competitionName(ctx)
  const headerText = `${name}: bidding closes in 1 hour`
  const bidStatus =
    ctx.sponsorHasBid === true
      ? "You have a bid in place."
      : "You have not yet placed a bid."

  return {
    preview: headerText,
    title: headerText,
    subtitle: formatRecipientSubtitle(
      ctx.recipientName,
      (recipient) =>
        `Hi ${recipient}, bidding for ${name} sponsorship closes in approximately 1 hour.`,
      `Bidding for ${name} sponsorship closes in approximately 1 hour.`
    ),
    ctaLabel: "View in portal",
    infoRows: [
      { label: "Competition", value: name },
      ...(ctx.endsAt !== undefined
        ? [
            {
              label: "Bidding closes",
              value: formatEmailDateTime(ctx.endsAt),
            },
          ]
        : []),
    ],
    bodyParagraphs: [bidStatus],
    footnoteParagraphs: [],
    showAntiSnipingNote: true,
  }
}

function lifecycleOutbidCopy(ctx: EmailCopyContext): EmailTemplateCopy {
  const name = competitionName(ctx)
  const headerText = `${name}: you have been outbid`

  return {
    preview: headerText,
    title: headerText,
    subtitle: formatRecipientSubtitle(
      ctx.recipientName,
      (recipient) =>
        `Hi ${recipient}, you have been outbid in the sponsorship auction for ${name}.`,
      `You have been outbid in the sponsorship auction for ${name}.`
    ),
    ctaLabel: "Place a new bid",
    infoRows: [
      { label: "Competition", value: name },
      ...(ctx.endsAt !== undefined
        ? [
            {
              label: "Bidding closes",
              value: formatEmailDateTime(ctx.endsAt),
            },
          ]
        : []),
    ],
    bodyParagraphs: [],
    footnoteParagraphs: [],
    showAntiSnipingNote: true,
  }
}

function scheduleInfoRows(ctx: EmailCopyContext): EmailInfoRow[] {
  const rows: EmailInfoRow[] = []
  if (ctx.startsAt !== undefined) {
    rows.push({
      label: "Bidding opens",
      value: formatEmailDateTime(ctx.startsAt),
    })
  }
  if (ctx.endsAt !== undefined) {
    rows.push({
      label: "Bidding closes",
      value: formatEmailDateTime(ctx.endsAt),
    })
  }
  return rows
}

function outcomeCopy(
  type: SponsorshipOutcomeEmailType,
  ctx: EmailCopyContext
): EmailTemplateCopy {
  const { contacts } = sponsorshipConfig()
  const name = competitionName(ctx)

  switch (type) {
    case "auction_started": {
      const body =
        ctx.endsAt !== undefined
          ? `Bidding is now live. Submit your bid before ${formatEmailDateTime(ctx.endsAt)}.`
          : "Bidding is now live in the sponsor portal."
      return {
        preview: "Sponsorship bidding has started",
        title: `${name} sponsorship is open`,
        subtitle: formatRecipientSubtitle(
          ctx.recipientName,
          (recipient) => `Hi ${recipient}, ${body}`,
          body
        ),
        ctaLabel: "Open auction",
        infoRows: [
          { label: "Competition", value: name },
          { label: "Status", value: "Bidding open" },
          ...scheduleInfoRows(ctx),
        ],
        bodyParagraphs: [],
        footnoteParagraphs: [PORTAL_REVISIT_FOOTNOTE],
        showAntiSnipingNote: false,
      }
    }
    case "auction_closed_winner": {
      const body =
        ctx.settlementAmountCents !== undefined
          ? `Congratulations. Your winning bid is ${formatMoney(ctx.settlementAmountCents)}. The ${contacts.sponsorshipTeamName} will follow up with invoice details.`
          : `Congratulations. You are the confirmed sponsor. The ${contacts.sponsorshipTeamName} will follow up with invoice details.`
      const infoRows: EmailInfoRow[] = [
        { label: "Competition", value: name },
        { label: "Status", value: "Winner confirmed" },
      ]
      if (ctx.settlementAmountCents !== undefined) {
        infoRows.push({
          label: "Winning bid",
          value: formatMoney(ctx.settlementAmountCents),
        })
      }
      infoRows.push(...scheduleInfoRows(ctx))
      return {
        preview: "You are the winning sponsor",
        title: `You won ${name}`,
        subtitle: formatRecipientSubtitle(
          ctx.recipientName,
          (recipient) => `Hi ${recipient}, ${body}`,
          body
        ),
        ctaLabel: "View result",
        infoRows,
        bodyParagraphs: [],
        footnoteParagraphs: [PORTAL_REVISIT_FOOTNOTE],
        showAntiSnipingNote: false,
      }
    }
    case "auction_closed_outbid": {
      const body =
        "This sponsorship auction has now closed. Thank you for participating."
      return {
        preview: "Auction has closed",
        title: `${name} bidding closed`,
        subtitle: formatRecipientSubtitle(
          ctx.recipientName,
          (recipient) => `Hi ${recipient}, ${body}`,
          body
        ),
        ctaLabel: "View outcome",
        infoRows: [
          { label: "Competition", value: name },
          { label: "Status", value: "Auction closed" },
          ...scheduleInfoRows(ctx),
        ],
        bodyParagraphs: [],
        footnoteParagraphs: [PORTAL_REVISIT_FOOTNOTE],
        showAntiSnipingNote: false,
      }
    }
    case "auction_closed_none": {
      const body = "This sponsorship auction closed without a winning bid."
      return {
        preview: "Auction closed without a winner",
        title: `${name} closed with no winner`,
        subtitle: formatRecipientSubtitle(
          ctx.recipientName,
          (recipient) => `Hi ${recipient}, ${body}`,
          body
        ),
        ctaLabel: "View auction",
        infoRows: [
          { label: "Competition", value: name },
          { label: "Status", value: "No winner" },
          ...scheduleInfoRows(ctx),
        ],
        bodyParagraphs: [],
        footnoteParagraphs: [PORTAL_REVISIT_FOOTNOTE],
        showAntiSnipingNote: false,
      }
    }
  }
}

function internalInvoiceCopy(ctx: EmailCopyContext): EmailTemplateCopy {
  const name = competitionName(ctx)
  const hasWinner = Boolean(ctx.winnerSponsorName)
  const outcomeLabel = hasWinner ? "Winner confirmed" : "No winner"
  const outcomeValue = hasWinner
    ? (ctx.winnerSponsorName ?? "Unknown sponsor")
    : "No winning sponsor"

  const infoRows: EmailInfoRow[] = [
    { label: "Competition", value: name },
    { label: outcomeLabel, value: outcomeValue },
  ]
  if (ctx.settlementAmountCents !== undefined) {
    infoRows.push({
      label: "Winning bid",
      value: formatMoney(ctx.settlementAmountCents),
    })
  }

  return {
    preview: `${name} sponsorship outcome`,
    title: "Invoice follow-up required",
    subtitle: `Please review the sponsorship outcome and complete invoice follow-up in ${productName}.`,
    ctaLabel: "Open sponsorship admin",
    infoRows,
    bodyParagraphs: [],
    footnoteParagraphs: [],
    showAntiSnipingNote: false,
  }
}

function inviteCopy(ctx: EmailCopyContext): EmailTemplateCopy {
  const sponsorName = ctx.sponsorName ?? "Sponsor"
  return {
    preview: "Sponsor portal access details",
    title: "Sponsor portal access",
    subtitle: `Hi ${sponsorName}, your sponsor portal account is ready.`,
    ctaLabel: "Open sponsor portal",
    infoRows: [],
    bodyParagraphs: [],
    footnoteParagraphs: [],
    showAntiSnipingNote: false,
  }
}

export const INVITE_GETTING_STARTED_STEPS = [
  "1) Open the sponsor portal using the button below.",
  "2) Sign in using the one-time email code we send you.",
] as const

export const INVITE_PORTAL_URL_HINT = "You can reuse this link for future bids."

export const INTERNAL_INVOICE_NEXT_STEPS = [
  "1) Confirm sponsorship status on the competition record.",
  "2) Send invoice and payment instructions.",
  `3) Record follow-up actions in ${productName}.`,
] as const

export function sponsorshipEmailSubject(
  type: SponsorshipEmailType,
  ctx: EmailCopyContext
): string {
  const { sponsorship } = sponsorshipConfig()
  const name = competitionName(ctx)
  switch (type) {
    case "invite":
      return `${sponsorship.portalName} access`
    case "auction_scheduled":
      return `${name}: bidding opening soon`
    case "auction_started":
      return `${name}: sponsorship bidding is live`
    case "auction_active_reminder":
      return `${name}: bidding closes in 1 hour`
    case "auction_ebay_outbid":
      return `${name}: you have been outbid`
    case "auction_closed_winner":
      return `${name}: you are the confirmed sponsor`
    case "auction_closed_outbid":
    case "auction_closed_none":
      return `${name}: sponsorship auction closed`
    case "internal_invoice":
      return `${name}: sponsorship invoice follow-up required`
  }
}

export function sponsorshipEmailMessageFallback(
  type: SponsorshipEmailType,
  ctx: EmailCopyContext
): string {
  const { sponsorship, contacts } = sponsorshipConfig()
  switch (type) {
    case "invite":
      return "Open the sponsor portal and sign in with the one-time email code we send you."
    case "auction_scheduled":
      return "A sponsorship auction has been scheduled. You will be notified when bidding opens."
    case "auction_started":
      return `Sponsorship bidding is now live in the ${sponsorship.portalName}. Please submit your bid before closing time.`
    case "auction_active_reminder":
      return "Bidding for this sponsorship auction closes in approximately 1 hour."
    case "auction_ebay_outbid":
      return "You have been outbid in this sponsorship auction."
    case "auction_closed_winner":
      return ctx.settlementAmountCents !== undefined
        ? `You won the sponsorship auction at ${formatMoney(ctx.settlementAmountCents)}. The ${contacts.sponsorshipTeamName} will follow up with invoice details.`
        : `You won the sponsorship auction. The ${contacts.sponsorshipTeamName} will follow up with invoice details.`
    case "auction_closed_outbid":
      return "This sponsorship auction has now closed. Thank you for participating."
    case "auction_closed_none":
      return "This sponsorship auction closed without a winning bid."
    case "internal_invoice":
      if (ctx.winnerSponsorName !== undefined) {
        const amount =
          ctx.settlementAmountCents !== undefined
            ? ` at ${formatMoney(ctx.settlementAmountCents)}`
            : ""
        return `Winner confirmed: ${ctx.winnerSponsorName}${amount}. Send invoice follow-up.`
      }
      return "No winning sponsor. Mark competition sponsorship status as None or relaunch."
  }
}

export function sponsorshipEmailTemplateCopy(
  type: SponsorshipEmailType,
  ctx: EmailCopyContext
): EmailTemplateCopy {
  switch (type) {
    case "invite":
      return inviteCopy(ctx)
    case "auction_scheduled":
      return lifecycleScheduledCopy(ctx)
    case "auction_active_reminder":
      return lifecycleActiveReminderCopy(ctx)
    case "auction_ebay_outbid":
      return lifecycleOutbidCopy(ctx)
    case "auction_started":
    case "auction_closed_winner":
    case "auction_closed_outbid":
    case "auction_closed_none":
      return outcomeCopy(type, ctx)
    case "internal_invoice":
      return internalInvoiceCopy(ctx)
  }
}

export function getSponsorshipEmailPayload(
  type: SponsorshipEmailType,
  ctx: EmailCopyContext
): { subject: string; message: string } {
  return {
    subject: sponsorshipEmailSubject(type, ctx),
    message: sponsorshipEmailMessageFallback(type, ctx),
  }
}

const OTP_EMAIL_TITLES: Record<SponsorPortalOtpPurpose, string> = {
  "sign in": "Your sign-in code",
  "verify your email": "Your email verification code",
  "change your email": "Your email change code",
}

export function sponsorOtpAuthEmailSubject(type: SponsorOtpAuthType): string {
  const { sponsorship } = sponsorshipConfig()
  const subjects: Record<SponsorOtpAuthType, string> = {
    "sign-in": `${sponsorship.portalName} sign-in code`,
    "forget-password": `${sponsorship.portalName} sign-in code`,
    "email-verification": `${sponsorship.portalName} email verification code`,
    "change-email": `${sponsorship.portalName} email change code`,
  }
  return subjects[type]
}

export function sponsorOtpPurposeFromAuthType(
  type: SponsorOtpAuthType
): SponsorPortalOtpPurpose {
  switch (type) {
    case "sign-in":
    case "forget-password":
      return "sign in"
    case "email-verification":
      return "verify your email"
    case "change-email":
      return "change your email"
  }
}

export function sponsorOtpEmailTemplateCopy(props: {
  purposeLabel: SponsorPortalOtpPurpose
  otp: string
  expiresInMinutes: number
}): EmailTemplateCopy {
  const { sponsorship } = sponsorshipConfig()
  return {
    preview: `${props.otp} is your ${sponsorship.portalName} code`,
    title: OTP_EMAIL_TITLES[props.purposeLabel],
    subtitle: `Use the code below to ${props.purposeLabel} on the ${sponsorship.portalName}.`,
    ctaLabel: "Open sponsor portal",
    infoRows: [],
    bodyParagraphs: [],
    footnoteParagraphs: [],
    showAntiSnipingNote: false,
  }
}
