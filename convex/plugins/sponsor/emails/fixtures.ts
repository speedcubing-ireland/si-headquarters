import type { SponsorPortalOtpEmailProps } from "@/convex/plugins/sponsor/lib/validators"
import {
  sponsorshipAdminPageUrl,
  sponsorPortalAuctionsIndexUrl,
  sponsorPortalLoginUrl,
} from "@/convex/plugins/sponsor/siteUrls"
import { sponsorPortalGuideUrl } from "@/convex/plugins/sponsor/siteUrls"

const competitionName = "Irish Open 2026"
const recipientName = "Sponsor Team"
const portalUrl = sponsorPortalAuctionsIndexUrl()

const auctionTimestamps = {
  startsAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
  endsAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
} as const

const auctionContext = {
  recipientName,
  competitionName,
  portalUrl,
  ...auctionTimestamps,
} as const

export const fixtures = {
  invite: {
    sponsorName: "Example Sponsor",
    portalUrl: sponsorPortalLoginUrl(),
  },
  otpSignIn: {
    otp: "847291",
    purposeLabel: "sign in",
    expiresInMinutes: 60,
    portalUrl: sponsorPortalLoginUrl(),
  } satisfies SponsorPortalOtpEmailProps,
  auctionScheduled: {
    variant: "auction_scheduled",
    ...auctionContext,
    framework: "first_sealed",
    frameworkGuideUrl: sponsorPortalGuideUrl(),
    startPriceCents: 10_000,
    currency: "EUR",
  },
  auctionActiveReminder: {
    variant: "auction_active_reminder",
    recipientName,
    competitionName,
    portalUrl,
    endsAt: Date.now() + 60 * 60 * 1000,
    sponsorHasBid: true,
  },
  auctionEbayOutbid: {
    variant: "auction_ebay_outbid",
    recipientName,
    competitionName,
    portalUrl,
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
    portalUrl,
  },
  auctionClosedOutbid: {
    variant: "auction_closed_outbid",
    recipientName,
    competitionName,
    portalUrl,
  },
  auctionClosedNone: {
    variant: "auction_closed_none",
    recipientName,
    competitionName,
    portalUrl,
  },
  internalInvoiceWinner: {
    competitionName,
    winnerSponsorName: "Example Sponsor",
    settlementAmountCents: 125_000,
    adminUrl: sponsorshipAdminPageUrl(),
    message:
      "Winner confirmed: Example Sponsor at EUR 1250.00. Send invoice follow-up.",
  },
  internalInvoiceNoWinner: {
    competitionName,
    adminUrl: sponsorshipAdminPageUrl(),
    message: "No winning sponsor. Mark competition sponsorship status as None.",
  },
} as const
