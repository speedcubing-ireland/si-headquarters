import type { Doc } from "@/convex/_generated/dataModel";
import { isSealedAuctionFramework } from "@/convex/plugins/sponsor/lib/sponsorTypes"

type AuctionVisibilityInput = Pick<
	Doc<"sponsorshipAuctions">,
	"state" | "framework"
>;

export function isSponsorVisibleAuctionState(
	state: Doc<"sponsorshipAuctions">["state"],
): boolean {
	return state === "scheduled" || state === "active" || state === "closed";
}

export function isBidHistoryVisibleToSponsor(
	auction: AuctionVisibilityInput,
): boolean {
	if (isSealedAuctionFramework(auction.framework)) {
		return false;
	}
	return auction.state === "active" || auction.state === "closed";
}
