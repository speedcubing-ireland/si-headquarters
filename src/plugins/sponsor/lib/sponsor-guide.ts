export const SPONSOR_TEAM_EMAIL = "sponsorship@speedcubingireland.com";

export const SPONSOR_PORTAL_INTRO = {
	title: "Sponsor portal",
	lead: "Thank you for your continued support of Speedcubing Ireland CLG (Speedcubing Ireland).",
	body: "Use this portal to view auctions, place bids, and review results. Each competition may use a different auction format, chosen by Speedcubing Ireland for that event.",
} as const;

export const SPONSOR_LOGIN_STEPS = [
	"Open the sponsor portal in your browser.",
	"Enter the email address we have on file for your sponsor account.",
	'Click "Send code" to receive a one-time sign-in code by email.',
	'Enter the code in the "One-time email code" field.',
	"If the page refreshed, confirm your email is still entered, then sign in.",
	"You stay signed in for up to 30 days unless you sign out.",
] as const;

export const SPONSOR_AUCTIONS_OVERVIEW = {
	title: "Auctions",
	body: "The portal lists scheduled, active, and closed sponsorship auctions. Each auction shows when bidding opens and closes, which format is used, and competition details where available.",
	formatsIntro:
		"Speedcubing Ireland sets one format per competition. The auction page shows which applies before you bid.",
} as const;

export interface SponsorshipFrameworkGuide {
	title: string;
	tagline: string;
	summary: string;
	bidding: readonly string[];
	closing: readonly string[];
	notes?: readonly string[];
}

export const SPONSORSHIP_FRAMEWORK_GUIDES = {
	first_sealed: {
		title: "Sealed Bid",
		tagline: "Hidden bids until close — similar to our previous system.",
		summary:
			"Submit a sealed bid amount for the competition. You can change it before the auction closes; only your latest valid bid counts. Other sponsors' bids stay hidden until close.",
		bidding: [
			"Enter a bid amount only (maximum/auto-bid is not available).",
			"You may update your bid before close; only your latest valid bid counts.",
			"If two bids tie, the earliest valid bid wins.",
			"Each bid must be at least the competition minimum shown on the auction page. That minimum stays the same for the whole auction.",
		],
		closing: [
			"The highest valid bid wins and pays their bid amount.",
			"After close, the winning bid amount is revealed.",
		],
	},
	vickrey: {
		title: "Vickrey Auction",
		tagline: "Hidden bids; the winner pays the second-highest bid.",
		summary:
			"Bidding works like a sealed bid auction. The highest bidder wins but usually pays the second-highest valid bid (or the competition minimum if they are the only bidder).",
		bidding: [
			"Enter a bid amount only (maximum/auto-bid is not available).",
			"You may update your bid before close; only your latest valid bid counts.",
			"If two bids tie, the earliest valid bid wins.",
			"Each bid must be at least the competition minimum shown on the auction page. That minimum stays the same for the whole auction.",
		],
		closing: [
			"The highest valid bid wins.",
			"The winner pays the second-highest valid bid, or the competition minimum if they are the only bidder.",
			"After close, others see the settlement amount paid — not the winner's full bid.",
		],
	},
	ebay_proxy: {
		title: "Proxy Bidding",
		tagline: "Open bidding with optional automatic counter-bids.",
		summary:
			"Current bids are visible while the auction is active. Place a direct bid and optionally set a maximum; if you are outbid, the system can raise your bid automatically up to that maximum.",
		bidding: [
			"All bids are visible during the auction.",
			"Place a direct bid and/or set a maximum bid for automatic counter-bidding.",
			"Each new bid must be at least the current minimum next bid shown on the auction page (the start price when there are no bids, otherwise the current price plus the increment for that price level).",
			"Bids placed near the closing time may extend the auction (anti-sniping).",
		],
		closing: [
			"The leader when the auction ends wins and pays the final visible price.",
		],
		notes: [
			"You may receive emails when you are outbid. Delivery can take several minutes and emails are not guaranteed — keep checking the auction page.",
		],
	},
} as const satisfies Record<
	"first_sealed" | "vickrey" | "ebay_proxy",
	SponsorshipFrameworkGuide
>;

/** Bid increment ladder — proxy bidding only. */
export const SPONSOR_PROXY_BID_INCREMENTS = {
	title: "Bid increments (proxy auctions only)",
	description:
		"Sealed bid and Vickrey auctions use a fixed competition minimum only — no increment ladder. In proxy auctions, the minimum for your next bid is the current leading price plus the increment below (or the competition start price when there are no bids yet).",
} as const;

export interface ProxyBidIncrementRow {
	rangeLabel: string;
	incrementLabel: string;
}

/** Matches eBay DE EUR increment brackets used by the bidding engine. */
export const PROXY_BID_INCREMENT_ROWS: readonly ProxyBidIncrementRow[] = [
	{ rangeLabel: "EUR 1.00 to 4.99", incrementLabel: "EUR 0.20" },
	{ rangeLabel: "EUR 5.00 to 24.99", incrementLabel: "EUR 0.50" },
	{ rangeLabel: "EUR 25.00 to 99.99", incrementLabel: "EUR 1.00" },
	{ rangeLabel: "EUR 100.00 to 249.99", incrementLabel: "EUR 2.50" },
	{ rangeLabel: "EUR 250.00 to 499.99", incrementLabel: "EUR 5.00" },
	{ rangeLabel: "EUR 500.00 to 999.99", incrementLabel: "EUR 10.00" },
	{ rangeLabel: "EUR 1,000.00 to 2,499.99", incrementLabel: "EUR 20.00" },
	{ rangeLabel: "EUR 2,500.00 to 4,999.99", incrementLabel: "EUR 50.00" },
	{ rangeLabel: "EUR 5,000.00 and above", incrementLabel: "EUR 100.00" },
];

export const SPONSOR_CLOSING_AND_RESULTS = {
	title: "Closing and results",
	body: "When an auction ends, the system applies the rules for that format to pick a winner and final price. The winner is notified; the portal shows the outcome on the auction page.",
} as const;

export const SPONSOR_BIDDING_NOTICE = {
	title: "Bidding notice",
	paragraphs: [
		"Bids placed through the portal are binding and cannot be withdrawn, except where the auction page still allows you to change your bid before close.",
		"Failure to pay a winning bid may result in action such as exclusion from future sponsorship opportunities.",
		"If you hit a technical problem or need help, contact the sponsorship team straight away.",
	],
} as const;

export function sponsorshipFrameworkGuide(
	framework: keyof typeof SPONSORSHIP_FRAMEWORK_GUIDES,
): SponsorshipFrameworkGuide {
	return SPONSORSHIP_FRAMEWORK_GUIDES[framework];
}

export function sponsorshipFrameworkGuideBullets(
	framework: keyof typeof SPONSORSHIP_FRAMEWORK_GUIDES,
): readonly string[] {
	const guide = sponsorshipFrameworkGuide(framework);
	return [...guide.bidding, ...guide.closing, ...(guide.notes ?? [])];
}
