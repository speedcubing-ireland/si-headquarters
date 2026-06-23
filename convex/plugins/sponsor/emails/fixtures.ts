import type { SponsorPortalOtpEmailProps } from "@/convex/plugins/sponsor/lib/validators"
import { organisationConfig } from "@/config/lib/organisation"

const competitionName = "Irish Open 2026"
const recipientName = "Sponsor Team"
const portalBaseUrl = `https://${organisationConfig.sponsorship.productionHost}`
const hqBaseUrl = "http://localhost:5173"
const portalLoginUrl = `${portalBaseUrl}/login`
const portalAuctionsUrl = `${portalBaseUrl}/auctions`
const portalGuideUrl = `${portalBaseUrl}/guide`
const adminUrl = `${hqBaseUrl}/plugins/sponsorship`

const auctionTimestamps = {
  startsAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
  endsAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
} as const

const auctionContext = {
  recipientName,
  competitionName,
  portalUrl: portalAuctionsUrl,
  ...auctionTimestamps,
} as const

export const fixtures = {
  invite: {
    sponsorName: "Example Sponsor",
    portalUrl: portalLoginUrl,
  },
  otpSignIn: {
    otp: "847291",
    purposeLabel: "sign in",
    expiresInMinutes: 60,
    portalUrl: portalLoginUrl,
  } satisfies SponsorPortalOtpEmailProps,
  auctionScheduled: {
    variant: "auction_scheduled",
    ...auctionContext,
    framework: "first_sealed",
    frameworkGuideUrl: portalGuideUrl,
    startPriceCents: 10_000,
    currency: organisationConfig.sponsorship.defaultCurrency,
  },
  auctionActiveReminder: {
    variant: "auction_active_reminder",
    recipientName,
    competitionName,
    portalUrl: portalAuctionsUrl,
    endsAt: Date.now() + 60 * 60 * 1000,
    sponsorHasBid: true,
  },
  auctionEbayOutbid: {
    variant: "auction_ebay_outbid",
    recipientName,
    competitionName,
    portalUrl: portalAuctionsUrl,
    endsAt: auctionTimestamps.endsAt,
  },
  auctionStarted: {
    variant: "auction_started",
    ...auctionContext,
  },
  auctionClosedWinner: {
    variant: "auction_closed_winner",
    recipientName,
    competitionName,
    settlementAmountCents: 125_000,
    portalUrl: portalAuctionsUrl,
  },
  auctionClosedOutbid: {
    variant: "auction_closed_outbid",
    recipientName,
    competitionName,
    portalUrl: portalAuctionsUrl,
  },
  auctionClosedNone: {
    variant: "auction_closed_none",
    recipientName,
    competitionName,
    portalUrl: portalAuctionsUrl,
  },
  internalInvoiceWinner: {
    competitionName,
    winnerSponsorName: "Example Sponsor",
    settlementAmountCents: 125_000,
    adminUrl,
    message: `Winner confirmed: Example Sponsor at ${organisationConfig.sponsorship.defaultCurrency} 1250.00. Send invoice follow-up.`,
  },
  internalInvoiceNoWinner: {
    competitionName,
    adminUrl,
    message: "No winning sponsor. Mark competition sponsorship status as None.",
  },
} as const
