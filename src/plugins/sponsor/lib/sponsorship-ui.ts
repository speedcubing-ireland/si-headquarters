export const SPONSORSHIP_FRAMEWORKS = [
	"first_sealed",
	"vickrey",
	"ebay_proxy",
] as const;

export type SponsorshipFramework = (typeof SPONSORSHIP_FRAMEWORKS)[number];
export const SPONSORSHIP_BIDDING_HELP_TITLE = "How this auction works";
export const SPONSOR_GUIDE_PAGE_TITLE = "Sponsor information";

export type SponsorBidStatus =
	| "winning"
	| "not_winning"
	| "winner"
	| "not_winner"
	| "bid_submitted"
	| "no_bid_submitted";

export type SponsorshipAuctionState =
	| "draft"
	| "scheduled"
	| "active"
	| "closed";

export type CompetitionSponsorPropertyStatus =
	| "not_offered"
	| "bidding"
	| "none"
	| "sponsor";

export type { SponsorshipFrameworkGuide } from "@/plugins/sponsor/lib/sponsor-guide";
export {
	sponsorshipFrameworkGuide,
	sponsorshipFrameworkGuideBullets,
} from "@/plugins/sponsor/lib/sponsor-guide";

export interface AuctionPriceFields {
	framework: SponsorshipFramework;
	state: SponsorshipAuctionState;
	startPriceCents: number;
	currentPriceCents?: number;
	settlementAmountCents?: number;
}

export function isSponsorshipFramework(
	value: string,
): value is SponsorshipFramework {
	return SPONSORSHIP_FRAMEWORKS.some((framework) => framework === value);
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

export function competitionPropertyStatusLabel(
	status: CompetitionSponsorPropertyStatus,
): string {
	switch (status) {
		case "bidding":
			return "Bidding in progress";
		case "sponsor":
			return "Sponsored";
		case "not_offered":
			return "Not offered";
		case "none":
			return "No sponsor yet";
	}
}

function closedPriceCents(auction: AuctionPriceFields): number {
	return (
		auction.settlementAmountCents ??
		auction.currentPriceCents ??
		auction.startPriceCents
	);
}

export function formatAuctionPriceLine(auction: AuctionPriceFields): string {
	if (
		isSealedSponsorshipFramework(auction.framework) &&
		auction.state !== "closed"
	) {
		return `Minimum bid: ${formatEuroFromCents(auction.startPriceCents)} · Price sealed until close`;
	}

	if (
		isSealedSponsorshipFramework(auction.framework) &&
		auction.state === "closed"
	) {
		return `Winning bid: ${formatEuroFromCents(closedPriceCents(auction))}`;
	}

	const current = formatEuroFromCents(
		auction.currentPriceCents ?? auction.startPriceCents,
	);
	if (
		auction.state === "closed" &&
		auction.settlementAmountCents !== undefined
	) {
		return `Current: ${current} · Winning bid: ${formatEuroFromCents(auction.settlementAmountCents)}`;
	}

	return `Current: ${current}`;
}

export function formatAuctionTablePrice(auction: AuctionPriceFields): {
	amountCents: number;
	showWinningBidLabel: boolean;
} {
	const isClosed = auction.state === "closed";
	const amountCents = isClosed
		? closedPriceCents(auction)
		: (auction.currentPriceCents ?? auction.startPriceCents);
	const showWinningBidLabel =
		isClosed &&
		(isSealedSponsorshipFramework(auction.framework) ||
			auction.settlementAmountCents !== undefined);

	return { amountCents, showWinningBidLabel };
}

export function normalizeSearchText(value: string): string {
	return value.trim().toLowerCase();
}

export function hasSameIdSet<T>(left: T[], right: T[]): boolean {
	if (left.length !== right.length) return false;
	const sortedLeft = left.map((id) => String(id)).sort();
	const sortedRight = right.map((id) => String(id)).sort();
	return sortedLeft.every((id, index) => id === sortedRight[index]);
}

export function toDatetimeLocalInput(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

export function parseDatetimeLocalInput(value: string): number | null {
	const millis = new Date(value).getTime();
	return Number.isFinite(millis) ? millis : null;
}

export function centsToEuroInput(cents: number | undefined): string {
	if (cents === undefined) return "";
	return (cents / 100).toFixed(2);
}
