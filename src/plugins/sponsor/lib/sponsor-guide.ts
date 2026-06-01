export const SPONSOR_TEAM_EMAIL = "sponsorship@speedcubingireland.com";

export const SPONSOR_PORTAL_INTRO = {
	title: "Sponsor portal",
	lead: "Thank you for your continued support of Speedcubing Ireland CLG (Speedcubing Ireland).",
	body: "We are improving how sponsorship bidding works. Use this portal to view auctions, place bids, and review results. Each competition may use a different auction format, chosen by Speedcubing Ireland for that event.",
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
	body: "From the portal you can see scheduled, active, and past auctions. Each auction shows its start and end time, auction format, and competition details where the competition is not yet publicly announced.",
	formatsIntro:
		"Each auction uses one of three formats. The auction page shows which format applies. We use standard auction terminology in case you want to read more about the format elsewhere.",
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
		tagline: "Most similar to our previous sponsorship system.",
		summary:
			"Each sponsor submits one hidden bid. You may update your bid, but only your latest submission counts. All bids stay hidden until the auction closes.",
		bidding: [
			"Submit a single hidden bid amount.",
			"Update your bid any time before close; only the latest bid counts.",
			"If two bids tie, the earliest valid bid wins.",
			"Bids must be at least the stated minimum bid.",
		],
		closing: [
			"The highest valid bid wins and pays the amount they bid.",
			"The winning bid is revealed to all parties after close.",
		],
	},
	vickrey: {
		title: "Vickrey Auction",
		tagline: "A sealed bid auction where the winner pays the second-highest bid.",
		summary:
			"Bidding works like a sealed bid auction, but the winner pays the second-highest valid bid (or the minimum bid if they are the only bidder). You can bid the full amount you are willing to pay without paying that full amount if others bid lower.",
		bidding: [
			"Submit a single hidden bid amount.",
			"Update your bid any time before close; only the latest bid counts.",
			"If two bids tie, the earliest valid bid wins.",
			"Bids must be at least the stated minimum bid.",
		],
		closing: [
			"The highest valid bid wins.",
			"The winner pays the second-highest valid bid, or the minimum bid if they are the only bidder.",
			"Other parties see the settlement amount (second-highest bid or minimum), not the winner's full bid.",
		],
	},
	ebay_proxy: {
		title: "Proxy Bidding",
		tagline: "Open bidding similar to eBay-style auctions.",
		summary:
			"Bids are visible to everyone while the auction is active. You can place a direct bid and optionally set a hidden maximum bid for automatic counter-bidding.",
		bidding: [
			"All bids are visible during the auction.",
			"Place a direct bid and optionally set a hidden maximum bid.",
			"If you are outbid and a maximum bid is set, the system bids on your behalf up to that maximum.",
			"Bids placed close to the closing time may extend the closing time to allow counter bids.",
		],
		closing: [
			"The highest valid bid when the auction ends wins and pays the final winning amount.",
		],
		notes: [
			"You may receive emails when you are outbid. Delivery can take several minutes and emails are not guaranteed, so refresh the auction page rather than relying on email alone.",
		],
	},
} as const satisfies Record<
	"first_sealed" | "vickrey" | "ebay_proxy",
	SponsorshipFrameworkGuide
>;

export const SPONSOR_MINIMUM_BIDS = {
	title: "Minimum bids",
	sealed:
		"For sealed bid and Vickrey auctions, each bid must be at least the stated minimum bid for that auction.",
	proxy:
		"Proxy bidding uses a dynamic minimum bid based on the current winning bid. The minimum next bid is the current winning bid plus the increment from the table below (starting from the auction minimum when there are no bids yet).",
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
	body: "When an auction ends, the system determines the winning sponsor according to the auction format. The winner is notified and the final price is shown alongside the winning bidder.",
} as const;

export const SPONSOR_BIDDING_NOTICE = {
	title: "Bidding notice",
	paragraphs: [
		"Bids placed through the system are non-revokable except where the software explicitly allows changes before close.",
		"Failure to pay a winning bid may result in action such as exclusion from future sponsorship opportunities.",
		"If you encounter a technical error or need help, contact the Speedcubing Ireland sponsorship team immediately.",
	],
} as const;

export function sponsorshipFrameworkGuide(
	framework: keyof typeof SPONSORSHIP_FRAMEWORK_GUIDES,
): SponsorshipFrameworkGuide {
	return SPONSORSHIP_FRAMEWORK_GUIDES[framework];
}

export function sponsorshipFrameworkGuideBullets<
	TFramework extends keyof typeof SPONSORSHIP_FRAMEWORK_GUIDES,
>(framework: TFramework): readonly string[] {
	const guide = sponsorshipFrameworkGuide(framework);
	return [...guide.bidding, ...guide.closing, ...(guide.notes ?? [])];
}
