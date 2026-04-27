import { v } from "convex/values";

export const SPONSORSHIP_AUCTION_FRAMEWORKS = [
	"first_sealed",
	"vickrey",
	"ebay_proxy",
] as const;
export type SponsorshipAuctionFramework =
	(typeof SPONSORSHIP_AUCTION_FRAMEWORKS)[number];

export const sponsorshipAuctionFramework = v.union(
	v.literal("first_sealed"),
	v.literal("vickrey"),
	v.literal("ebay_proxy"),
);

export function isProxyAuctionFramework(
	framework: SponsorshipAuctionFramework,
): boolean {
	return framework === "ebay_proxy";
}

export function isSealedAuctionFramework(
	framework: SponsorshipAuctionFramework,
): boolean {
	return !isProxyAuctionFramework(framework);
}

export type SealedAuctionPricingRule = "first_price" | "second_price";

export function sealedAuctionPricingRule(
	framework: SponsorshipAuctionFramework,
): SealedAuctionPricingRule {
	return framework === "first_sealed" ? "first_price" : "second_price";
}

export const sponsorshipAuctionState = v.union(
	v.literal("draft"),
	v.literal("scheduled"),
	v.literal("active"),
	v.literal("closed"),
);

export type SponsorshipEmailType =
	| "invite"
	| "auction_scheduled"
	| "auction_started"
	| "auction_closed_winner"
	| "auction_closed_outbid"
	| "auction_closed_none"
	| "internal_invoice";

export const sponsorshipEmailType = v.union(
	v.literal("invite"),
	v.literal("auction_scheduled"),
	v.literal("auction_started"),
	v.literal("auction_closed_winner"),
	v.literal("auction_closed_outbid"),
	v.literal("auction_closed_none"),
	v.literal("internal_invoice"),
);

export const sponsorshipBidIntentMode = v.union(
	v.literal("manual"),
	v.literal("proxy"),
);

export const competitionSponsorPropertyStatus = v.union(
	v.literal("not_offered"),
	v.literal("bidding"),
	v.literal("none"),
	v.literal("sponsor"),
);

export const sponsorForUI = v.object({
	id: v.id("sponsors"),
	name: v.string(),
	email: v.string(),
	avatarUrl: v.optional(v.string()),
	active: v.boolean(),
	hasAuthAccount: v.boolean(),
	lastAccessEmailSentAt: v.optional(v.number()),
});
