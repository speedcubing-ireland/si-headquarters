import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { placeSponsorshipBid } from "../../lib/sponsorshipBidPlacement";
import { competitionSponsorPropertyStatus } from "../../lib/sponsorshipValidators";
import {
	isBidHistoryVisibleToSponsor,
	isSponsorVisibleAuctionState,
} from "../../lib/sponsorshipVisibility";
import {
	requireAuctionInvite,
	requireSponsorSession,
	sponsorAuctionListItem,
	sponsorBidEventForUI,
	toSponsorBidEventForUI,
	toSponsorAuctionListItem,
} from "./shared";

async function listInvitedVisibleAuctions(
	ctx: QueryCtx,
	sponsorId: Id<"sponsors">,
): Promise<Doc<"sponsorshipAuctions">[]> {
	const invites = await ctx.db
		.query("sponsorshipAuctionInvites")
		.withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
		.collect();
	const auctions = await Promise.all(
		invites.map((invite) =>
			ctx.db.get("sponsorshipAuctions", invite.auctionId),
		),
	);
	return auctions.filter((auction): auction is Doc<"sponsorshipAuctions"> => {
		if (!auction) return false;
		return isSponsorVisibleAuctionState(auction.state);
	});
}

function buildBidderLabelBySponsorId(input: {
	events: Doc<"sponsorshipBidEvents">[];
	currentSponsorId: Id<"sponsors">;
}): Map<string, string> {
	const labels = new Map<string, string>();
	let nextBidderNumber = 1;
	for (const event of input.events) {
		if (!event.sponsorId || event.sponsorId === input.currentSponsorId)
			continue;
		if (labels.has(event.sponsorId)) continue;
		labels.set(event.sponsorId, `Bidder ${nextBidderNumber}`);
		nextBidderNumber += 1;
	}
	return labels;
}

function compareIntentChronology(
	a: Doc<"sponsorshipBidIntents">,
	b: Doc<"sponsorshipBidIntents">,
): number {
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	if (a._creationTime !== b._creationTime) {
		return a._creationTime - b._creationTime;
	}
	return 0;
}

export const listAuctions = query({
	args: { sessionToken: v.string() },
	returns: v.array(sponsorAuctionListItem),
	handler: async (ctx, args) => {
		const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
		const auctionDocs = await listInvitedVisibleAuctions(ctx, sponsor._id);
		const competitions = await Promise.all(
			auctionDocs.map((auction) =>
				ctx.db.get("competitions", auction.competitionId),
			),
		);
		const intentsByAuction = await Promise.all(
			auctionDocs.map((auction) =>
				ctx.db
					.query("sponsorshipBidIntents")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
			),
		);
		const competitionNames = new Map<Id<"competitions">, string>();
		for (const competition of competitions) {
			if (!competition) continue;
			competitionNames.set(competition._id, competition.name);
		}
		const hasAnyValidBidByAuctionId = new Map<
			Id<"sponsorshipAuctions">,
			boolean
		>();
		const hasSponsorValidBidByAuctionId = new Map<
			Id<"sponsorshipAuctions">,
			boolean
		>();
		for (let index = 0; index < auctionDocs.length; index += 1) {
			const auction = auctionDocs[index];
			if (!auction) continue;
			const intents = intentsByAuction[index] ?? [];
			hasAnyValidBidByAuctionId.set(
				auction._id,
				intents.some((intent) => intent.isValid),
			);
			hasSponsorValidBidByAuctionId.set(
				auction._id,
				intents.some(
					(intent) => intent.isValid && intent.sponsorId === sponsor._id,
				),
			);
		}

		return auctionDocs
			.sort((a, b) => b.endsAt - a.endsAt)
			.map((auction) =>
				toSponsorAuctionListItem({
					auction,
					competitionName:
						competitionNames.get(auction.competitionId) ?? "Competition",
					hasAnyValidBid: hasAnyValidBidByAuctionId.get(auction._id) ?? false,
					sponsorId: sponsor._id,
					hasSponsorValidBid:
						hasSponsorValidBidByAuctionId.get(auction._id) ?? false,
				}),
			);
	},
});

export const getAuction = query({
	args: {
		sessionToken: v.string(),
		auctionId: v.id("sponsorshipAuctions"),
	},
	returns: v.union(
		v.object({
			auction: sponsorAuctionListItem,
			events: v.array(sponsorBidEventForUI),
			bidHistoryVisible: v.boolean(),
			sponsorPropertyStatus: competitionSponsorPropertyStatus,
			myLastBidCents: v.optional(v.number()),
			myMaxBidCents: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
		await requireAuctionInvite(ctx, args.auctionId, sponsor._id);

		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction || !isSponsorVisibleAuctionState(auction.state)) {
			return null;
		}
		const competition = await ctx.db.get("competitions", auction.competitionId);
		if (!competition) {
			return null;
		}

		const bidHistoryVisible = isBidHistoryVisibleToSponsor(auction);
		const [events, auctionIntents] = await Promise.all([
			bidHistoryVisible
				? ctx.db
						.query("sponsorshipBidEvents")
						.withIndex("by_auction_and_created_at", (q) =>
							q.eq("auctionId", auction._id),
						)
						.collect()
				: Promise.resolve([]),
			ctx.db
				.query("sponsorshipBidIntents")
				.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
				.collect(),
		]);
		const sponsorIntents = auctionIntents.filter(
			(intent) => intent.sponsorId === sponsor._id,
		);
		const hasAnyValidBid = auctionIntents.some((intent) => intent.isValid);
		const bidderLabelBySponsorId = buildBidderLabelBySponsorId({
			events,
			currentSponsorId: sponsor._id,
		});
		const latestSponsorIntent = sponsorIntents
			.filter((intent) => intent.isValid)
			.sort(compareIntentChronology)
			.slice(-1)[0];
		const myLastBidCents = latestSponsorIntent?.amountCents;
		const myMaxBidCents = latestSponsorIntent
			? (latestSponsorIntent.maxAmountCents ?? latestSponsorIntent.amountCents)
			: undefined;
		const hasSponsorValidBid = sponsorIntents.some((intent) => intent.isValid);
		const sponsorPropertyStatus:
			| "bidding"
			| "none"
			| "not_offered"
			| "sponsor" =
			auction.state === "active" || auction.state === "scheduled"
				? "bidding"
				: auction.winnerSponsorId
					? "sponsor"
					: "none";

		return {
			auction: toSponsorAuctionListItem({
				auction,
				competitionName: competition.name,
				hasAnyValidBid,
				sponsorId: sponsor._id,
				hasSponsorValidBid,
			}),
			events: events.map((event) =>
				toSponsorBidEventForUI({
					event,
					sponsorLabel:
						event.sponsorId === sponsor._id
							? "You"
							: event.sponsorId
								? (bidderLabelBySponsorId.get(event.sponsorId) ?? "Bidder")
								: "System",
					isOwnBid: event.sponsorId === sponsor._id,
				}),
			),
			bidHistoryVisible,
			sponsorPropertyStatus,
			myLastBidCents,
			myMaxBidCents,
		};
	},
});

export const placeBid = mutation({
	args: {
		sessionToken: v.string(),
		auctionId: v.id("sponsorshipAuctions"),
		amountCents: v.number(),
	},
	returns: v.object({
		currentPriceCents: v.number(),
		extendedEndsAt: v.optional(v.number()),
	}),
	handler: placeBidHandler,
});

export const setMaxBid = mutation({
	args: {
		sessionToken: v.string(),
		auctionId: v.id("sponsorshipAuctions"),
		maxAmountCents: v.number(),
	},
	returns: v.object({
		currentPriceCents: v.number(),
		extendedEndsAt: v.optional(v.number()),
	}),
	handler: setMaxBidHandler,
});

type PlaceBidArgs = {
	sessionToken: string;
	auctionId: Id<"sponsorshipAuctions">;
	amountCents: number;
};

type SetMaxBidArgs = {
	sessionToken: string;
	auctionId: Id<"sponsorshipAuctions">;
	maxAmountCents: number;
};

type SponsorBidMutationResult = {
	currentPriceCents: number;
	extendedEndsAt?: number;
};

export async function placeBidHandler(
	ctx: MutationCtx,
	args: PlaceBidArgs,
): Promise<SponsorBidMutationResult> {
	const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
	await requireAuctionInvite(ctx, args.auctionId, sponsor._id);

	const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
	if (!auction) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Auction not found.",
		});
	}
	const result = await placeSponsorshipBid(ctx, {
		auction,
		sponsorId: sponsor._id,
		amountCents: args.amountCents,
	});
	return {
		currentPriceCents: result.currentPriceCents,
		extendedEndsAt: result.extendedEndsAt,
	};
}

export async function setMaxBidHandler(
	ctx: MutationCtx,
	args: SetMaxBidArgs,
): Promise<SponsorBidMutationResult> {
	const { sponsor } = await requireSponsorSession(ctx, args.sessionToken);
	await requireAuctionInvite(ctx, args.auctionId, sponsor._id);

	const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
	if (!auction) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Auction not found.",
		});
	}
	if (auction.framework !== "ebay_proxy") {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Max bids are only available for eBay proxy auctions.",
		});
	}
	const result = await placeSponsorshipBid(ctx, {
		auction,
		sponsorId: sponsor._id,
		maxAmountCents: args.maxAmountCents,
	});
	return {
		currentPriceCents: result.currentPriceCents,
		extendedEndsAt: result.extendedEndsAt,
	};
}
