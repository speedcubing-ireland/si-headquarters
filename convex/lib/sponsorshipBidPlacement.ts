import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
	minNextBidCents,
	resolveProxyState,
	resolveSealedOutcome,
} from "./sponsorshipBidding";
import {
	isSealedAuctionFramework,
	sealedAuctionPricingRule,
} from "./sponsorshipValidators";

export type PlaceSponsorshipBidInput = {
	auction: Doc<"sponsorshipAuctions">;
	sponsorId: Id<"sponsors">;
	amountCents?: number;
	maxAmountCents?: number;
};

export type PlaceSponsorshipBidResult = {
	currentPriceCents: number;
	extendedEndsAt?: number;
};

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
			message: `Bid must be at least ${input.auction.startPriceCents / 100} EUR.`,
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
	if (!sealedState) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Unable to resolve sealed bid state.",
		});
	}

	const leaderSponsorId = intents.find(
		(intent) => String(intent.sponsorId) === sealedState.leaderSponsorId,
	)?.sponsorId;
	if (!leaderSponsorId) {
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
	const latestOwnIntent = existingIntents
		.filter((intent) => intent.isValid && intent.sponsorId === input.sponsorId)
		.sort(compareIntentChronology)
		.slice(-1)[0];
	const existingOwnMaxCents = latestOwnIntent
		? (latestOwnIntent.maxAmountCents ?? latestOwnIntent.amountCents)
		: undefined;
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
			message: `Bid must be at least ${minimumRequiredBidCents / 100} EUR.`,
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
			message: `Max amount must be at least ${minimumRequiredBidCents / 100} EUR.`,
		});
	}
	if (maxAmountCents === undefined) {
		maxAmountCents = !isAmountExplicit
			? amountCents
			: Math.max(existingOwnMaxCents ?? amountCents, amountCents);
	}
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

	const validIntentsInChronologicalOrder = intents
		.filter((intent) => intent.isValid)
		.sort(compareIntentChronology);
	const contenderBySponsorId = new Map<
		Id<"sponsors">,
		{
			maxAmountCents: number;
			firstMaxSetAt: number;
			firstMaxSetOrder: number;
		}
	>();
	for (const [index, intent] of validIntentsInChronologicalOrder.entries()) {
		const intentMaxAmountCents = intent.maxAmountCents ?? intent.amountCents;
		const existingContender = contenderBySponsorId.get(intent.sponsorId);
		if (!existingContender) {
			contenderBySponsorId.set(intent.sponsorId, {
				maxAmountCents: intentMaxAmountCents,
				firstMaxSetAt: intent.createdAt,
				firstMaxSetOrder: index,
			});
			continue;
		}
		const maxChanged =
			existingContender.maxAmountCents !== intentMaxAmountCents;
		contenderBySponsorId.set(intent.sponsorId, {
			maxAmountCents: intentMaxAmountCents,
			firstMaxSetAt: maxChanged
				? intent.createdAt
				: existingContender.firstMaxSetAt,
			firstMaxSetOrder: maxChanged ? index : existingContender.firstMaxSetOrder,
		});
	}

	const contenders = [...contenderBySponsorId.entries()].map(
		([sponsorId, contender]) => ({
			sponsorId,
			maxAmountCents: contender.maxAmountCents,
			firstMaxSetAt: contender.firstMaxSetAt,
			firstMaxSetOrder: contender.firstMaxSetOrder,
		}),
	);
	const state = resolveProxyState(contenders, input.auction.startPriceCents);
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

	return {
		currentPriceCents: visibleCurrentPriceCents,
		extendedEndsAt,
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
