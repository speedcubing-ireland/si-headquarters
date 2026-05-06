import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
	compareBidIntentChronology,
} from "../../lib/sponsorshipAuctionState";
import { placeSponsorshipBid } from "../../lib/sponsorshipBidPlacement";
import { buildCompetitionRecordSummary } from "../../lib/sponsorshipCompetitionSnapshot";
import {
	competitionSponsorPropertyStatus,
	isProxyAuctionFramework,
} from "../../lib/sponsorshipValidators";
import { sendEbayAuctionOutbidEmail } from "../auctions/emails";
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

async function maybeNotifyEbayOutbid(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
	result: { outbidSponsorId?: Id<"sponsors">; extendedEndsAt?: number },
): Promise<void> {
	if (!result.outbidSponsorId) return;
	const auctionForEmail = result.extendedEndsAt
		? { ...auction, endsAt: result.extendedEndsAt }
		: auction;
	await sendEbayAuctionOutbidEmail(
		ctx,
		auctionForEmail,
		result.outbidSponsorId,
	);
}

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

export function sponsorBidEventLabel(input: {
	eventSponsorId: Id<"sponsors"> | undefined;
	currentSponsorId: Id<"sponsors">;
}): string {
	if (!input.eventSponsorId) return "System";
	if (input.eventSponsorId === input.currentSponsorId) return "You";
	return "Bidder";
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
		const competitionById = new Map<Id<"competitions">, Doc<"competitions">>();
		for (const competition of competitions) {
			if (!competition) continue;
			competitionNames.set(competition._id, competition.name);
			competitionById.set(competition._id, competition);
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
			.map((auction) => {
				const competitionName =
					competitionNames.get(auction.competitionId) ?? "Competition";
				const competition = competitionById.get(auction.competitionId);
				const competitionSummary =
					auction.competitionSnapshot?.summary ??
					(competition
						? buildCompetitionRecordSummary({
								name: competition.name,
								compStart: competition.compStart,
								compEnd: competition.compEnd,
							})
						: buildCompetitionRecordSummary({
								name: competitionName,
								compStart: new Date(auction.startsAt)
									.toISOString()
									.slice(0, 10),
								compEnd: new Date(auction.endsAt).toISOString().slice(0, 10),
							}));
				const competitionSummarySource =
					auction.competitionSnapshot?.source ?? "competition_record";
				return toSponsorAuctionListItem({
					auction,
					competitionName,
					competitionSummary,
					competitionSummarySource,
					hasAnyValidBid: hasAnyValidBidByAuctionId.get(auction._id) ?? false,
					sponsorId: sponsor._id,
					hasSponsorValidBid:
						hasSponsorValidBidByAuctionId.get(auction._id) ?? false,
				});
			});
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
		const latestSponsorIntent = sponsorIntents
			.filter((intent) => intent.isValid)
			.sort(compareBidIntentChronology)
			.slice(-1)[0];
		const myLastBidCents = latestSponsorIntent?.amountCents;
		const myMaxBidCents = latestSponsorIntent
			? (latestSponsorIntent.maxAmountCents ?? latestSponsorIntent.amountCents)
			: undefined;
		const hasSponsorValidBid = sponsorIntents.some((intent) => intent.isValid);
		const derivedSponsorPropertyStatus:
			| "bidding"
			| "none"
			| "not_offered"
			| "sponsor" =
			auction.state === "active" || auction.state === "scheduled"
				? "bidding"
				: auction.winnerSponsorId
					? "sponsor"
					: "none";
		const sponsorPropertyStatus = competition.manualSponsorId
			? "sponsor"
			: (competition.manualSponsorPropertyStatus ??
				derivedSponsorPropertyStatus);
		const competitionSummary =
			auction.competitionSnapshot?.summary ??
			buildCompetitionRecordSummary({
				name: competition.name,
				compStart: competition.compStart,
				compEnd: competition.compEnd,
			});
		const competitionSummarySource =
			auction.competitionSnapshot?.source ?? "competition_record";

		return {
			auction: toSponsorAuctionListItem({
				auction,
				competitionName: competition.name,
				competitionSummary,
				competitionSummarySource,
				hasAnyValidBid,
				sponsorId: sponsor._id,
				hasSponsorValidBid,
			}),
			events: events.map((event) =>
				toSponsorBidEventForUI({
					event,
					sponsorLabel: sponsorBidEventLabel({
						eventSponsorId: event.sponsorId,
						currentSponsorId: sponsor._id,
					}),
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
	await maybeNotifyEbayOutbid(ctx, auction, result);
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
	if (!isProxyAuctionFramework(auction.framework)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Max bids are only available for Proxy Bidding auctions.",
		});
	}
	const result = await placeSponsorshipBid(ctx, {
		auction,
		sponsorId: sponsor._id,
		maxAmountCents: args.maxAmountCents,
	});
	await maybeNotifyEbayOutbid(ctx, auction, result);
	return {
		currentPriceCents: result.currentPriceCents,
		extendedEndsAt: result.extendedEndsAt,
	};
}
