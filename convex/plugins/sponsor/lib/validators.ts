import { v, type Infer } from "convex/values"

export const sponsorshipAuctionFramework = v.union(
  v.literal("first_sealed"),
  v.literal("vickrey"),
  v.literal("ebay_proxy")
)

export const auctionState = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("active"),
  v.literal("closed")
)

export const SPONSORSHIP_EMAIL_TYPES = [
  "invite",
  "auction_scheduled",
  "auction_started",
  "auction_active_reminder",
  "auction_ebay_outbid",
  "auction_closed_winner",
  "auction_closed_outbid",
  "auction_closed_none",
  "internal_invoice",
] as const

export const sponsorshipEmailType = v.union(
  ...SPONSORSHIP_EMAIL_TYPES.map((type) => v.literal(type))
)

export type SponsorshipEmailType = Infer<typeof sponsorshipEmailType>

/** Auction-related sponsorship emails (excludes sponsor invite). */
export const SPONSORSHIP_AUCTION_EMAIL_TYPES = [
  "auction_scheduled",
  "auction_started",
  "auction_active_reminder",
  "auction_ebay_outbid",
  "auction_closed_winner",
  "auction_closed_outbid",
  "auction_closed_none",
  "internal_invoice",
] as const satisfies readonly SponsorshipEmailType[]

export type SponsorshipAuctionEmailType =
  (typeof SPONSORSHIP_AUCTION_EMAIL_TYPES)[number]

export const SPONSORSHIP_LIFECYCLE_EMAIL_TYPES = [
  "auction_scheduled",
  "auction_active_reminder",
  "auction_ebay_outbid",
] as const satisfies readonly SponsorshipEmailType[]

export type SponsorshipLifecycleEmailType =
  (typeof SPONSORSHIP_LIFECYCLE_EMAIL_TYPES)[number]

export const SPONSORSHIP_OUTCOME_EMAIL_TYPES = [
  "auction_started",
  "auction_closed_winner",
  "auction_closed_outbid",
  "auction_closed_none",
] as const satisfies readonly SponsorshipEmailType[]

export type SponsorshipOutcomeEmailType =
  (typeof SPONSORSHIP_OUTCOME_EMAIL_TYPES)[number]

export const sponsorshipEmailContext = v.object({
  competitionName: v.optional(v.string()),
  portalUrl: v.optional(v.string()),
  adminUrl: v.optional(v.string()),
  settlementAmountCents: v.optional(v.number()),
  winnerSponsorName: v.optional(v.string()),
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
  frameworkDescription: v.optional(v.string()),
  framework: v.optional(sponsorshipAuctionFramework),
  frameworkGuideUrl: v.optional(v.string()),
  startPriceCents: v.optional(v.number()),
  currency: v.optional(v.string()),
  sponsorHasBid: v.optional(v.boolean()),
})

export type SponsorshipEmailContext = Infer<typeof sponsorshipEmailContext>

export const sponsorshipEmailRecipient = v.object({
  sponsorId: v.optional(v.id("sponsors")),
  email: v.string(),
  name: v.optional(v.string()),
  cc: v.optional(v.array(v.string())),
})

export type SponsorshipEmailRecipient = Infer<typeof sponsorshipEmailRecipient>

export const scheduleSponsorshipEmailBatchArgs = v.object({
  auctionId: v.optional(v.id("sponsorshipAuctions")),
  emailType: sponsorshipEmailType,
  subject: v.string(),
  message: v.string(),
  recipients: v.array(sponsorshipEmailRecipient),
  context: v.optional(sponsorshipEmailContext),
})

export type ScheduleSponsorshipEmailBatchArgs = Infer<
  typeof scheduleSponsorshipEmailBatchArgs
>

export const SPONSOR_PORTAL_OTP_PURPOSES = [
  "sign in",
  "verify your email",
  "change your email",
] as const

export const sponsorPortalOtpPurpose = v.union(
  ...SPONSOR_PORTAL_OTP_PURPOSES.map((purpose) => v.literal(purpose))
)

export type SponsorPortalOtpPurpose = Infer<typeof sponsorPortalOtpPurpose>

export const SPONSOR_OTP_AUTH_TYPES = [
  "sign-in",
  "forget-password",
  "email-verification",
  "change-email",
] as const

export type SponsorOtpAuthType = (typeof SPONSOR_OTP_AUTH_TYPES)[number]

export const sponsorPortalOtpEmailProps = v.object({
  otp: v.string(),
  purposeLabel: sponsorPortalOtpPurpose,
  expiresInMinutes: v.number(),
  portalUrl: v.string(),
})

export type SponsorPortalOtpEmailProps = Infer<
  typeof sponsorPortalOtpEmailProps
>

export const sponsorshipBidIntentMode = v.union(
  v.literal("manual"),
  v.literal("proxy")
)

export const competitionSponsorPropertyStatus = v.union(
  v.literal("not_offered"),
  v.literal("bidding"),
  v.literal("none"),
  v.literal("sponsor")
)

export const sponsorForUI = v.object({
  id: v.id("sponsors"),
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  active: v.boolean(),
  hasAuthAccount: v.boolean(),
  lastAccessEmailSentAt: v.optional(v.number()),
})

export const sponsorContactPermissions = v.object({
  canBid: v.boolean(),
  portalAccess: v.boolean(),
  receivesCc: v.boolean(),
})

export const sponsorContactForUI = v.object({
  id: v.id("sponsorContacts"),
  sponsorId: v.id("sponsors"),
  name: v.string(),
  email: v.string(),
  active: v.boolean(),
  isPrimary: v.boolean(),
  receivesCc: v.boolean(),
  portalAccess: v.boolean(),
  canBid: v.boolean(),
  hasAuthAccount: v.boolean(),
  lastAccessEmailSentAt: v.optional(v.number()),
})

export const sponsorPortalMe = v.object({
  sponsor: sponsorForUI,
  contact: v.optional(sponsorContactForUI),
  permissions: sponsorContactPermissions,
})

export const sponsorCompetitionFields = {
  manualSponsorPropertyStatus: v.optional(competitionSponsorPropertyStatus),
  manualSponsorId: v.optional(v.id("sponsors")),
}
