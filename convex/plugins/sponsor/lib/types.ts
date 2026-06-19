export const SPONSORSHIP_AUCTION_FRAMEWORKS = [
  "first_sealed",
  "vickrey",
  "ebay_proxy",
] as const

export type SponsorshipAuctionFramework =
  (typeof SPONSORSHIP_AUCTION_FRAMEWORKS)[number]

export function isProxyAuctionFramework(
  framework: SponsorshipAuctionFramework
): boolean {
  return framework === "ebay_proxy"
}

export function isSealedAuctionFramework(
  framework: SponsorshipAuctionFramework
): boolean {
  return !isProxyAuctionFramework(framework)
}

export function auctionFrameworkLabel(
  framework: SponsorshipAuctionFramework
): string {
  switch (framework) {
    case "first_sealed":
      return "Sealed Bid"
    case "vickrey":
      return "Vickrey Auction"
    case "ebay_proxy":
      return "Proxy Bidding"
  }
}

export type SealedAuctionPricingRule = "first_price" | "second_price"

export function sealedAuctionPricingRule(
  framework: SponsorshipAuctionFramework
): SealedAuctionPricingRule {
  return framework === "first_sealed" ? "first_price" : "second_price"
}

export type {
  SponsorshipAuctionEmailType,
  SponsorshipEmailContext,
  SponsorshipEmailRecipient,
  SponsorshipEmailType,
  SponsorshipLifecycleEmailType,
  SponsorshipOutcomeEmailType,
  SponsorOtpAuthType,
  SponsorPortalOtpEmailProps,
  SponsorPortalOtpPurpose,
} from "./validators"
