import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { MutationCtx } from "@/convex/_generated/server";
import {
	buildProxyContenders,
	compareBidIntentChronologyWithIdTieBreak,
} from "./auctionState";
import {
	minNextBidCents,
	resolveProxyState,
	resolveSealedOutcome,
} from "./bidding";
import {
	isSealedAuctionFramework,
	sealedAuctionPricingRule,
} from "@/convex/plugins/sponsor/lib/sponsorTypes"

export interface PlaceSponsorshipBidInput {
	auction: Doc<"sponsorshipAuctions">;
	sponsorId: Id<"sponsors">;
	amountCents?: number;
	maxAmountCents?: number;
}

export interface PlaceSponsorshipBidResult {
	currentPriceCents: number;
	extendedEndsAt?: number;
	outbidSponsorId?: Id<"sponsors">;
}

function normalizeAmountCents(input: number): number {
	const amountCents = Math.floor(input);
	if (!Number.isFinite(amountCents) || amountCents < 100) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Bid amount must be at least EUR 1.00.",
		});
	}
	return amountCents;
}

function normalizeMaxAmountCents(
	amountCents: number,
	input: number | undefined,
): number | undefined {
	if (input === undefined) return undefined;
	const maxAmountCents = Math.floor(input);
	if (!Number.isFinite(maxAmountCents) || maxAmountCents < amountCents) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Max amount must be greater than or equal to bid amount.",
		});
	}
	return maxAmountCents;
}

function ensureActiveAuction(auction: Doc<"sponsorshipAuctions">): void {
	if (auction.state !== "active") {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Bidding is not open for this auction.",
		});
	}
	if (Date.now() > auction.endsAt) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Auction has already closed.",
		});
	}
}

async function placeSealedBid(
	ctx: MutationCtx,
	input: PlaceSponsorshipBidInput,
	existingIntents: Doc<"sponsorshipBidIntents">[],
	now: number,
): Promise<PlaceSponsorshipBidResult> {
	if (input.maxAmountCents !== undefined) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Max bids are not available for sealed auctions.",
		});
	}
	if (input.amountCents === undefined) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Enter a bid amount.",
		});
	}

	const amountCents = normalizeAmountCents(input.amountCents);
	if (amountCents < input.auction.startPriceCents) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Bid must be at least ${String(input.auction.startPriceCents / 100)} EUR.`,
		});
	}

	const intentId = await ctx.db.insert("sponsorshipBidIntents", {
		auctionId: input.auction._id,
		sponsorId: input.sponsorId,
		mode: "manual",
		amountCents,
		maxAmountCents: amountCents,
		isValid: true,
		createdAt: now,
	});
	const intents: Doc<"sponsorshipBidIntents">[] = [
		...existingIntents,
		{
			_id: intentId,
			_creationTime: now,
			auctionId: input.auction._id,
			sponsorId: input.sponsorId,
			mode: "manual",
			amountCents,
			maxAmountCents: amountCents,
			isValid: true,
			createdAt: now,
		},
	];

	const sealedState = resolveSealedOutcome(
		intents
			.filter((intent) => intent.isValid)
			.map((intent) => ({
				intentId: String(intent._id),
				sponsorId: String(intent.sponsorId),
				amountCents: intent.amountCents,
				createdAt: intent.createdAt,
				createdOrder: intent._creationTime,
			})),
		{
			pricing: sealedAuctionPricingRule(input.auction.framework),
			reservePriceCents: input.auction.startPriceCents,
		},
	);
	if (sealedState === null) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Unable to resolve sealed bid state.",
		});
	}

	const leaderSponsorId = intents.find(
		(intent) => String(intent.sponsorId) === sealedState.leaderSponsorId,
	)?.sponsorId;
	if (leaderSponsorId === undefined) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Unable to resolve sealed bid leader.",
		});
	}

	await ctx.db.patch("sponsorshipAuctions", input.auction._id, {
		currentPriceCents: sealedState.leaderBidCents,
		currentLeaderSponsorId: leaderSponsorId,
		currentLeaderMaxCents: sealedState.leaderBidCents,
		updatedAt: now,
	});

	return {
		currentPriceCents: input.auction.startPriceCents,
	};
}

async function placeProxyBid(
	ctx: MutationCtx,
	input: PlaceSponsorshipBidInput,
	existingIntents: Doc<"sponsorshipBidIntents">[],
	now: number,
): Promise<PlaceSponsorshipBidResult> {
	const hasExistingValidBid = existingIntents.some((intent) => intent.isValid);
	const effectiveCurrentPriceCents = hasExistingValidBid
		? (input.auction.currentPriceCents ?? input.auction.startPriceCents)
		: null;
	const minimumRequiredBidCents = minNextBidCents(
		effectiveCurrentPriceCents,
		input.auction.startPriceCents,
	);
	if (input.amountCents === undefined && input.maxAmountCents === undefined) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Enter a bid amount or max amount.",
		});
	}

	const explicitAmountCents = input.amountCents;
	const explicitMaxAmountCents = input.maxAmountCents;
	const isAmountExplicit = explicitAmountCents !== undefined;
	const isMaxExplicit = explicitMaxAmountCents !== undefined;
	const ownValidIntents = existingIntents
		.filter((intent) => intent.isValid && intent.sponsorId === input.sponsorId)
		.sort(compareBidIntentChronologyWithIdTieBreak);
	const latestOwnIntent = ownValidIntents.at(-1);
	const existingOwnMaxCents = latestOwnIntent?.maxAmountCents;
	const amountCents =
		explicitAmountCents !== undefined
			? normalizeAmountCents(explicitAmountCents)
			: (latestOwnIntent?.amountCents ?? minimumRequiredBidCents);
	if (
		explicitAmountCents !== undefined &&
		amountCents < minimumRequiredBidCents
	) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Bid must be at least ${String(minimumRequiredBidCents / 100)} EUR.`,
		});
	}
	let maxAmountCents =
		explicitMaxAmountCents !== undefined
			? normalizeMaxAmountCents(amountCents, explicitMaxAmountCents)
			: undefined;
	if (
		!isAmountExplicit &&
		maxAmountCents !== undefined &&
		maxAmountCents < minimumRequiredBidCents
	) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `Max amount must be at least ${String(minimumRequiredBidCents / 100)} EUR.`,
		});
	}
	maxAmountCents ??= !isAmountExplicit
		? amountCents
		: Math.max(existingOwnMaxCents ?? amountCents, amountCents);
	const mode = maxAmountCents > amountCents ? "proxy" : "manual";

	const intentId = await ctx.db.insert("sponsorshipBidIntents", {
		auctionId: input.auction._id,
		sponsorId: input.sponsorId,
		mode,
		amountCents,
		maxAmountCents,
		isValid: true,
		createdAt: now,
	});
	const intents: Doc<"sponsorshipBidIntents">[] = [
		...existingIntents,
		{
			_id: intentId,
			_creationTime: now,
			auctionId: input.auction._id,
			sponsorId: input.sponsorId,
			mode,
			amountCents,
			maxAmountCents,
			isValid: true,
			createdAt: now,
		},
	];

	const validIntentsInChronologicalOrder = intents.filter(
		(intent) => intent.isValid,
	);
	const state = resolveProxyState(
		buildProxyContenders(
			validIntentsInChronologicalOrder,
			compareBidIntentChronologyWithIdTieBreak,
		),
		input.auction.startPriceCents,
	);
	if (!state) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Unable to resolve proxy state.",
		});
	}

	const previousLeaderSponsorId = hasExistingValidBid
		? input.auction.currentLeaderSponsorId
		: undefined;
	const previousVisiblePriceCents = hasExistingValidBid
		? (input.auction.currentPriceCents ?? input.auction.startPriceCents)
		: input.auction.startPriceCents;
	const isMaxOnlyIntent = !isAmountExplicit && isMaxExplicit;
	let visibleCurrentPriceCents =
		isMaxOnlyIntent &&
		previousLeaderSponsorId === input.sponsorId &&
		state.leaderSponsorId === input.sponsorId
			? previousVisiblePriceCents
			: state.currentPriceCents;
	const isExplicitDirectBidFromCurrentLeader =
		isAmountExplicit &&
		previousLeaderSponsorId === input.sponsorId &&
		state.leaderSponsorId === input.sponsorId;
	if (isExplicitDirectBidFromCurrentLeader) {
		visibleCurrentPriceCents = Math.max(visibleCurrentPriceCents, amountCents);
	}
	const visibleStateChanged =
		previousLeaderSponsorId !== state.leaderSponsorId ||
		previousVisiblePriceCents !== visibleCurrentPriceCents;
	const shouldCollapseToResolvedPrice =
		state.leaderSponsorId !== input.sponsorId ||
		visibleCurrentPriceCents !== amountCents;

	if (visibleStateChanged && shouldCollapseToResolvedPrice) {
		await ctx.db.insert("sponsorshipBidEvents", {
			auctionId: input.auction._id,
			sponsorId: state.leaderSponsorId,
			amountCents: visibleCurrentPriceCents,
			isAuto: true,
			intentId:
				state.leaderSponsorId === input.sponsorId ? intentId : undefined,
			createdAt: now,
		});
	} else if (visibleStateChanged) {
		await ctx.db.insert("sponsorshipBidEvents", {
			auctionId: input.auction._id,
			sponsorId: input.sponsorId,
			amountCents,
			isAuto: false,
			intentId,
			createdAt: now,
		});

		const autoEventAmountCents = visibleCurrentPriceCents;
		const shouldInsertAutoEvent =
			autoEventAmountCents >= amountCents &&
			(state.leaderSponsorId !== input.sponsorId ||
				autoEventAmountCents > amountCents);
		if (shouldInsertAutoEvent) {
			await ctx.db.insert("sponsorshipBidEvents", {
				auctionId: input.auction._id,
				sponsorId: state.leaderSponsorId,
				amountCents: autoEventAmountCents,
				isAuto: true,
				createdAt: now,
			});
		}
	}

	let extendedEndsAt: number | undefined;
	const withinSnipingWindow =
		input.auction.endsAt - now <= input.auction.antiSnipingWindowMs;
	if (withinSnipingWindow) {
		extendedEndsAt = input.auction.endsAt + input.auction.antiSnipingExtendMs;
	}

	await ctx.db.patch("sponsorshipAuctions", input.auction._id, {
		currentPriceCents: visibleCurrentPriceCents,
		currentLeaderSponsorId: state.leaderSponsorId,
		currentLeaderMaxCents: state.leaderMaxCents,
		endsAt: extendedEndsAt ?? input.auction.endsAt,
		updatedAt: now,
	});

	let outbidSponsorId: Id<"sponsors"> | undefined;
	if (
		previousLeaderSponsorId !== undefined &&
		previousLeaderSponsorId !== state.leaderSponsorId
	) {
		outbidSponsorId = previousLeaderSponsorId;
	} else if (state.leaderSponsorId !== input.sponsorId) {
		outbidSponsorId = input.sponsorId;
	}

	return {
		currentPriceCents: visibleCurrentPriceCents,
		extendedEndsAt,
		outbidSponsorId,
	};
}

export async function placeSponsorshipBid(
	ctx: MutationCtx,
	input: PlaceSponsorshipBidInput,
): Promise<PlaceSponsorshipBidResult> {
	ensureActiveAuction(input.auction);
	const now = Date.now();
	const existingIntents = await ctx.db
		.query("sponsorshipBidIntents")
		.withIndex("by_auction", (q) => q.eq("auctionId", input.auction._id))
		.collect();

	if (isSealedAuctionFramework(input.auction.framework)) {
		return placeSealedBid(ctx, input, existingIntents, now);
	}
	return placeProxyBid(ctx, input, existingIntents, now);
}
