import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { requireSponsorByAuthSessionToken } from "../authAccounts";
import { minNextBidCents } from "../../lib/sponsorshipBidding";
import {
	isProxyAuctionFramework,
	isSealedAuctionFramework,
	sponsorshipAuctionFramework,
	sponsorshipAuctionState,
} from "../../lib/sponsorshipValidators";
import {
	sponsorshipCompetitionSummary,
	sponsorshipCompetitionSummarySource,
} from "../../lib/sponsorshipCompetitionSnapshot";

type SponsorCtx = QueryCtx | MutationCtx;
type SponsorBidStatus =
	| "winning"
	| "not_winning"
	| "winner"
	| "not_winner"
	| "bid_submitted"
	| "no_bid_submitted";

export const sponsorAuctionListItem = v.object({
	id: v.id("sponsorshipAuctions"),
	competitionId: v.id("competitions"),
	competitionName: v.string(),
	framework: sponsorshipAuctionFramework,
	state: sponsorshipAuctionState,
	currency: v.string(),
	competitionSummary: sponsorshipCompetitionSummary,
	competitionSummarySource: sponsorshipCompetitionSummarySource,
	startsAt: v.number(),
	endsAt: v.number(),
	startPriceCents: v.number(),
	currentPriceCents: v.optional(v.number()),
	minimumNextBidCents: v.number(),
	settlementAmountCents: v.optional(v.number()),
	sponsorBidStatus: v.optional(
		v.union(
			v.literal("winning"),
			v.literal("not_winning"),
			v.literal("winner"),
			v.literal("not_winner"),
			v.literal("bid_submitted"),
			v.literal("no_bid_submitted"),
		),
	),
});

export const sponsorBidEventForUI = v.object({
	id: v.id("sponsorshipBidEvents"),
	sponsorLabel: v.string(),
	isOwnBid: v.boolean(),
	amountCents: v.number(),
	isAuto: v.boolean(),
	createdAt: v.number(),
});

export function toSponsorBidEventForUI(input: {
	event: Doc<"sponsorshipBidEvents">;
	sponsorLabel: string;
	isOwnBid: boolean;
}) {
	return {
		id: input.event._id,
		sponsorLabel: input.sponsorLabel,
		isOwnBid: input.isOwnBid,
		amountCents: input.event.amountCents,
		isAuto: input.isOwnBid ? input.event.isAuto : true,
		createdAt: input.event.createdAt,
	};
}

export async function requireSponsorSession(
	ctx: SponsorCtx,
	sessionToken: string,
): Promise<{ sponsor: Doc<"sponsors"> }> {
	const { sponsor } = await requireSponsorByAuthSessionToken(ctx, sessionToken);
	return { sponsor };
}

export async function requireAuctionInvite(
	ctx: SponsorCtx,
	auctionId: Id<"sponsorshipAuctions">,
	sponsorId: Id<"sponsors">,
): Promise<void> {
	const invite = await ctx.db
		.query("sponsorshipAuctionInvites")
		.withIndex("by_auction_and_sponsor", (q) =>
			q.eq("auctionId", auctionId).eq("sponsorId", sponsorId),
		)
		.unique();
	if (!invite) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You are not invited to this auction.",
		});
	}
}

export function toSponsorAuctionListItem(input: {
	auction: Doc<"sponsorshipAuctions">;
	competitionName: string;
	competitionSummary: {
		name: string;
		address: string;
		startDate: string;
		endDate: string;
		competitorLimit?: number;
		eventIds: string[];
	};
	competitionSummarySource: "competition_record" | "wca";
	hasAnyValidBid: boolean;
	sponsorId?: Id<"sponsors">;
	hasSponsorValidBid?: boolean;
}) {
	const {
		auction,
		competitionName,
		competitionSummary,
		competitionSummarySource,
		hasAnyValidBid,
		sponsorId,
		hasSponsorValidBid,
	} = input;
	const isSealed = isSealedAuctionFramework(auction.framework);
	const effectiveCurrentPriceCents = hasAnyValidBid
		? (auction.currentPriceCents ?? auction.startPriceCents)
		: null;
	const currentPriceCents = isSealed ? undefined : auction.currentPriceCents;
	const minimumNextBidCents = isSealed
		? auction.startPriceCents
		: minNextBidCents(effectiveCurrentPriceCents, auction.startPriceCents);
	const sponsorBidStatus: SponsorBidStatus | undefined =
		sponsorId === undefined
			? undefined
			: isProxyAuctionFramework(auction.framework)
				? auction.state === "active"
					? auction.currentLeaderSponsorId === sponsorId
						? "winning"
						: "not_winning"
					: auction.state === "closed"
						? auction.winnerSponsorId === sponsorId
							? "winner"
							: "not_winner"
						: undefined
				: auction.state === "active"
					? hasSponsorValidBid
						? "bid_submitted"
						: "no_bid_submitted"
					: auction.state === "closed"
						? hasSponsorValidBid
							? auction.winnerSponsorId === sponsorId
								? "winner"
								: "not_winner"
							: "no_bid_submitted"
						: undefined;

	return {
		id: auction._id,
		competitionId: auction.competitionId,
		competitionName,
		framework: auction.framework,
		state: auction.state,
		currency: auction.currency,
		competitionSummary,
		competitionSummarySource,
		startsAt: auction.startsAt,
		endsAt: auction.endsAt,
		startPriceCents: auction.startPriceCents,
		currentPriceCents,
		minimumNextBidCents,
		settlementAmountCents: auction.settlementAmountCents,
		...(sponsorBidStatus ? { sponsorBidStatus } : {}),
	};
}
