import type { Competition } from "@/data/types-new";

export type CompetitionTaskSummary = {
	total: number;
	done: number;
	inProgress: number;
	blocked: number;
	phaseTaskCount: number;
	completionPercent: number;
};

export type WcaSearchResult = {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
};

export function parseGoogleSheetId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (urlMatch) return urlMatch[1];
	if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
	return null;
}

export function sponsorStatusLabel(competition: Competition): string {
	switch (competition.sponsorPropertyStatus) {
		case "not_offered":
			return "Not offered";
		case "bidding":
			return "Bidding";
		case "none":
			return "None";
		case "sponsor":
			return competition.sponsorPropertyDisplay ?? "Sponsor";
		default:
			return "None";
	}
}

export function sponsorStatusBadgeVariant(
	status: Competition["sponsorPropertyStatus"],
): "secondary" | "outline" | "destructive" | "default" {
	switch (status) {
		case "not_offered":
			return "outline";
		case "bidding":
			return "secondary";
		case "none":
			return "destructive";
		case "sponsor":
			return "default";
		default:
			return "outline";
	}
}

export function auctionDerivedSponsorLabel(competition: Competition): string {
	if (competition.auctionDerivedSponsorPropertyStatus === "sponsor") {
		return competition.auctionDerivedSponsorPropertyDisplay ?? "Sponsor";
	}
	switch (competition.auctionDerivedSponsorPropertyStatus) {
		case "bidding":
			return "Bidding in progress";
		case "none":
			return "No sponsor";
		default:
			return "Not offered";
	}
}

export function formatWinningBid(cents: number): string {
	return new Intl.NumberFormat("en-IE", {
		style: "currency",
		currency: "EUR",
	}).format(cents / 100);
}
