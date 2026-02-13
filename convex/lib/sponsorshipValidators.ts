import { v } from "convex/values";

export const sponsorshipAuctionFramework = v.union(
	v.literal("first_sealed"),
	v.literal("ebay_proxy"),
);

export const sponsorshipAuctionState = v.union(
	v.literal("draft"),
	v.literal("scheduled"),
	v.literal("active"),
	v.literal("closed"),
);

export type SponsorshipEmailType =
	| "invite"
	| "auction_started"
	| "auction_winner"
	| "auction_outbid"
	| "auction_closed_none"
	| "internal_invoice";

export const sponsorshipEmailType = v.union(
	v.literal("invite"),
	v.literal("auction_started"),
	v.literal("auction_winner"),
	v.literal("auction_outbid"),
	v.literal("auction_closed_none"),
	v.literal("internal_invoice"),
);

export type SponsorshipEmailDispatchStatus =
	| "pending"
	| "sending"
	| "sent"
	| "failed";

export const sponsorshipEmailDispatchStatus = v.union(
	v.literal("pending"),
	v.literal("sending"),
	v.literal("sent"),
	v.literal("failed"),
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
