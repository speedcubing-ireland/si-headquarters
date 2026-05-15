import type { Doc, Id } from "../../_generated/dataModel";
import { resolveProxyState, resolveSealedOutcome } from "./bidding";
import {
	isProxyAuctionFramework,
	sealedAuctionPricingRule,
} from "./validators";

type AuctionDoc = Doc<"sponsorshipAuctions">;
type IntentDoc = Doc<"sponsorshipBidIntents">;

export function compareBidIntentChronology(a: IntentDoc, b: IntentDoc): number {
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	if (a._creationTime !== b._creationTime) {
		return a._creationTime - b._creationTime;
	}
	return 0;
}

export function compareBidIntentChronologyWithIdTieBreak(
	a: IntentDoc,
	b: IntentDoc,
): number {
	const chronology = compareBidIntentChronology(a, b);
	if (chronology !== 0) return chronology;
	return String(a._id).localeCompare(String(b._id));
}

export function latestBidIntentBySponsor(
	intents: IntentDoc[],
	compare: (
		a: IntentDoc,
		b: IntentDoc,
	) => number = compareBidIntentChronologyWithIdTieBreak,
): Map<Id<"sponsors">, IntentDoc> {
	const latestIntentBySponsor = new Map<Id<"sponsors">, IntentDoc>();
	for (const intent of intents) {
		const latestIntent = latestIntentBySponsor.get(intent.sponsorId);
		if (!latestIntent || compare(intent, latestIntent) > 0) {
			latestIntentBySponsor.set(intent.sponsorId, intent);
		}
	}
	return latestIntentBySponsor;
}

export function buildProxyContenders(
	intents: IntentDoc[],
	compare: (
		a: IntentDoc,
		b: IntentDoc,
	) => number = compareBidIntentChronologyWithIdTieBreak,
): Array<{
	sponsorId: Id<"sponsors">;
	maxAmountCents: number;
	firstMaxSetAt: number;
	firstMaxSetOrder: number;
}> {
	const contenderBySponsorId = new Map<
		Id<"sponsors">,
		{
			firstMaxSetAt: number;
			firstMaxSetOrder: number;
			maxAmountCents: number;
		}
	>();
	for (const [index, intent] of [...intents].sort(compare).entries()) {
		const maxAmountCents = intent.maxAmountCents ?? intent.amountCents;
		const existingContender = contenderBySponsorId.get(intent.sponsorId);
		if (!existingContender) {
			contenderBySponsorId.set(intent.sponsorId, {
				maxAmountCents,
				firstMaxSetAt: intent.createdAt,
				firstMaxSetOrder: index,
			});
			continue;
		}
		const maxChanged = existingContender.maxAmountCents !== maxAmountCents;
		contenderBySponsorId.set(intent.sponsorId, {
			maxAmountCents,
			firstMaxSetAt: maxChanged
				? intent.createdAt
				: existingContender.firstMaxSetAt,
			firstMaxSetOrder: maxChanged ? index : existingContender.firstMaxSetOrder,
		});
	}
	return [...contenderBySponsorId.entries()].map(([sponsorId, contender]) => ({
		sponsorId,
		maxAmountCents: contender.maxAmountCents,
		firstMaxSetAt: contender.firstMaxSetAt,
		firstMaxSetOrder: contender.firstMaxSetOrder,
	}));
}

export function resolveAuctionBidState(args: {
	auction: AuctionDoc;
	validIntents: IntentDoc[];
}): Pick<
	AuctionDoc,
	"currentLeaderMaxCents" | "currentLeaderSponsorId" | "currentPriceCents"
> {
	if (args.validIntents.length === 0) {
		return {
			currentPriceCents: undefined,
			currentLeaderSponsorId: undefined,
			currentLeaderMaxCents: undefined,
		};
	}

	if (!isProxyAuctionFramework(args.auction.framework)) {
		const sealedState = resolveSealedOutcome(
			args.validIntents.map((intent) => ({
				intentId: String(intent._id),
				sponsorId: String(intent.sponsorId),
				amountCents: intent.amountCents,
				createdAt: intent.createdAt,
				createdOrder: intent._creationTime,
			})),
			{
				pricing: sealedAuctionPricingRule(args.auction.framework),
				reservePriceCents: args.auction.startPriceCents,
			},
		);
		if (!sealedState) {
			return {
				currentPriceCents: undefined,
				currentLeaderSponsorId: undefined,
				currentLeaderMaxCents: undefined,
			};
		}
		const leaderIntent = args.validIntents.find(
			(intent) => String(intent._id) === sealedState.leaderIntentId,
		);
		if (!leaderIntent) {
			return {
				currentPriceCents: undefined,
				currentLeaderSponsorId: undefined,
				currentLeaderMaxCents: undefined,
			};
		}
		return {
			currentPriceCents: sealedState.leaderBidCents,
			currentLeaderSponsorId: leaderIntent.sponsorId,
			currentLeaderMaxCents: sealedState.leaderBidCents,
		};
	}

	const state = resolveProxyState(
		buildProxyContenders(args.validIntents),
		args.auction.startPriceCents,
	);
	if (!state) {
		return {
			currentPriceCents: undefined,
			currentLeaderSponsorId: undefined,
			currentLeaderMaxCents: undefined,
		};
	}
	return {
		currentPriceCents: state.currentPriceCents,
		currentLeaderSponsorId: state.leaderSponsorId,
		currentLeaderMaxCents: state.leaderMaxCents,
	};
}

export function resolveAuctionOutcome(args: {
	auction: AuctionDoc;
	validIntents: IntentDoc[];
}): Pick<
	AuctionDoc,
	"winnerSponsorId" | "winningBidId" | "settlementAmountCents"
> {
	if (args.validIntents.length === 0) {
		return {
			winnerSponsorId: undefined,
			winningBidId: undefined,
			settlementAmountCents: undefined,
		};
	}

	if (!isProxyAuctionFramework(args.auction.framework)) {
		const sealedState = resolveSealedOutcome(
			args.validIntents.map((intent) => ({
				intentId: String(intent._id),
				sponsorId: String(intent.sponsorId),
				amountCents: intent.amountCents,
				createdAt: intent.createdAt,
				createdOrder: intent._creationTime,
			})),
			{
				pricing: sealedAuctionPricingRule(args.auction.framework),
				reservePriceCents: args.auction.startPriceCents,
			},
		);
		if (!sealedState) {
			return {
				winnerSponsorId: undefined,
				winningBidId: undefined,
				settlementAmountCents: undefined,
			};
		}
		const winnerIntent = args.validIntents.find(
			(intent) => String(intent._id) === sealedState.leaderIntentId,
		);
		return {
			winnerSponsorId: winnerIntent?.sponsorId,
			winningBidId: winnerIntent?._id,
			settlementAmountCents: winnerIntent
				? sealedState.settlementBidCents
				: undefined,
		};
	}

	const latestIntentBySponsor = latestBidIntentBySponsor(args.validIntents);
	const currentLeaderIntent = args.auction.currentLeaderSponsorId
		? latestIntentBySponsor.get(args.auction.currentLeaderSponsorId)
		: undefined;

	let winnerSponsorId = currentLeaderIntent?.sponsorId;
	let settlementAmountCents = winnerSponsorId
		? (args.auction.currentPriceCents ?? args.auction.startPriceCents)
		: undefined;

	if (!winnerSponsorId) {
		const state = resolveProxyState(
			buildProxyContenders(args.validIntents),
			args.auction.startPriceCents,
		);
		winnerSponsorId = state?.leaderSponsorId;
		settlementAmountCents = state?.currentPriceCents;
	}

	const winnerIntent = winnerSponsorId
		? latestIntentBySponsor.get(winnerSponsorId)
		: undefined;
	return {
		winnerSponsorId,
		winningBidId: winnerIntent?._id,
		settlementAmountCents,
	};
}
