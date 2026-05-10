export const SPONSORSHIP_FRAMEWORKS = [
	"first_sealed",
	"vickrey",
	"ebay_proxy",
] as const;

export type SponsorshipFramework = (typeof SPONSORSHIP_FRAMEWORKS)[number];
export const SPONSORSHIP_BIDDING_HELP_TITLE = "How bidding works";
export const SPONSOR_BID_STATUSES = [
	"winning",
	"not_winning",
	"winner",
	"not_winner",
	"bid_submitted",
	"no_bid_submitted",
] as const;

export type SponsorBidStatus = (typeof SPONSOR_BID_STATUSES)[number];

type SponsorshipFrameworkGuide = {
	title: string;
	summary: string;
	rules: readonly string[];
};

export function isSponsorshipFramework(
	value: string,
): value is SponsorshipFramework {
	return (SPONSORSHIP_FRAMEWORKS as readonly string[]).includes(value);
}

export function isProxySponsorshipFramework(
	framework: SponsorshipFramework,
): boolean {
	return framework === "ebay_proxy";
}

export function isSealedSponsorshipFramework(
	framework: SponsorshipFramework,
): boolean {
	return !isProxySponsorshipFramework(framework);
}

export const SPONSORSHIP_AUCTION_STATES = [
	"draft",
	"scheduled",
	"active",
	"closed",
] as const;

export type SponsorshipAuctionState =
	(typeof SPONSORSHIP_AUCTION_STATES)[number];

export function sponsorshipFrameworkLabel(
	framework: SponsorshipFramework,
): string {
	switch (framework) {
		case "first_sealed":
			return "Sealed Bid";
		case "vickrey":
			return "Vickrey Auction";
		case "ebay_proxy":
			return "Proxy Bidding";
	}
}

const FRAMEWORK_GUIDES: Record<
	SponsorshipFramework,
	SponsorshipFrameworkGuide
> = {
	first_sealed: {
		title: "Sealed Bid",
		summary:
			"You submit one hidden bid amount. The highest valid bid wins and pays their own amount.",
		rules: [
			"Only your latest submitted bid counts.",
			"Bid amounts stay hidden until the auction closes.",
			"The winner pays their own final bid.",
		],
	},
	vickrey: {
		title: "Vickrey Auction",
		summary:
			"You submit one hidden bid amount. The highest valid bid wins and pays the second-highest valid bid, or the minimum start price if only one valid bid is submitted.",
		rules: [
			"Only your latest submitted bid counts.",
			"Bid amounts stay hidden until the auction closes.",
			"The winner pays the second-highest valid bid (never below the start price).",
			"If there is only one valid bid, the winner pays the start price (minimum price).",
		],
	},
	ebay_proxy: {
		title: "Proxy Bidding",
		summary:
			"Similar to eBay auctions, you can place a direct bid and an optional max bid. The system automatically raises your bid only when needed.",
		rules: [
			"Bids are visible while the auction is active.",
			"Set a max bid to let the system auto-bid on your behalf.",
			"Near auction closing, new bids may extend the closing time.",
			"You pay only the final winning bid, not always your max.",
		],
	},
};

export function sponsorshipFrameworkGuide(
	framework: SponsorshipFramework,
): SponsorshipFrameworkGuide {
	return FRAMEWORK_GUIDES[framework];
}

export function sponsorBidStatusLabel(status: SponsorBidStatus): string {
	switch (status) {
		case "winning":
			return "Winning";
		case "not_winning":
			return "Not winning";
		case "winner":
			return "Winner";
		case "not_winner":
			return "Not winner";
		case "bid_submitted":
			return "Bid submitted";
		case "no_bid_submitted":
			return "No bid submitted";
	}
}

export function sponsorshipStateLabel(state: SponsorshipAuctionState): string {
	switch (state) {
		case "draft":
			return "Draft";
		case "scheduled":
			return "Scheduled";
		case "active":
			return "Active";
		case "closed":
			return "Closed";
	}
}

export function sponsorshipStateBadgeVariant(
	state: SponsorshipAuctionState,
): "default" | "secondary" | "outline" {
	switch (state) {
		case "active":
			return "default";
		case "scheduled":
			return "secondary";
		case "draft":
		case "closed":
			return "outline";
	}
}

export function formatEuroFromCents(cents: number): string {
	return `EUR ${(cents / 100).toFixed(2)}`;
}

export function formatDateTime(value: number): string {
	return new Date(value).toLocaleString();
}
