export const SPONSORSHIP_FRAMEWORKS = ["first_sealed", "ebay_proxy"] as const;

export type SponsorshipFramework = (typeof SPONSORSHIP_FRAMEWORKS)[number];

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
			return "First Sealed Bid";
		case "ebay_proxy":
			return "eBay Proxy";
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
