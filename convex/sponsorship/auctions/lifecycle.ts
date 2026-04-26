import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { requireSponsorshipManager } from "../../lib/sponsorshipAccess";
import {
	resolveProxyState,
	resolveSealedOutcome,
} from "../../lib/sponsorshipBidding";
import {
	isSealedAuctionFramework,
	sealedAuctionPricingRule,
} from "../../lib/sponsorshipValidators";
import { resolveAuctionStartTargetState } from "../../lib/sponsorshipLifecycle";
import {
	requireNoOpenAuctionForCompetition,
	type SponsorshipReadinessSnapshot,
} from "./shared";
import {
	cacheCompetitionFallbackSnapshot,
	scheduleCompetitionSnapshotRefresh,
} from "./competitionSnapshot";
import {
	sendAuctionClosureEmails,
	sendAuctionScheduledEmails,
	sendAuctionStartedEmails,
} from "./emails";
import { syncLifecycleRuntimeCron } from "./runtimeCron";

function compareIntentChronology(
	a: Doc<"sponsorshipBidIntents">,
	b: Doc<"sponsorshipBidIntents">,
): number {
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	if (a._creationTime !== b._creationTime) {
		return a._creationTime - b._creationTime;
	}
	return String(a._id).localeCompare(String(b._id));
}

async function buildReadinessSnapshot(
	competition: Doc<"competitions">,
): Promise<SponsorshipReadinessSnapshot> {
	const warnings: string[] = [];
	if (!competition.compLeadId) {
		warnings.push("Competition lead is not set.");
	}
	if (!competition.leadDelegateId) {
		warnings.push("Lead delegate is not set.");
	}
	if (!competition.compSheet) {
		warnings.push("Competition Google Sheet is not linked.");
	}
	return {
		checkedAt: Date.now(),
		warnings,
	};
}

export async function closeAuctionInternal(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	if (auction.state === "closed") return;
	const intents = await ctx.db
		.query("sponsorshipBidIntents")
		.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
		.collect();
	const validIntents = intents.filter((intent) => intent.isValid);
	let winnerSponsorId: Id<"sponsors"> | undefined;
	let winningBidId: Id<"sponsorshipBidIntents"> | undefined;
	let settlementAmountCents: number | undefined;

	if (isSealedAuctionFramework(auction.framework)) {
		const sealedState = resolveSealedOutcome(
			validIntents.map((intent) => ({
				intentId: String(intent._id),
				sponsorId: String(intent.sponsorId),
				amountCents: intent.amountCents,
				createdAt: intent.createdAt,
				createdOrder: intent._creationTime,
			})),
			{
				pricing: sealedAuctionPricingRule(auction.framework),
				reservePriceCents: auction.startPriceCents,
			},
		);
		if (sealedState) {
			const winnerIntent = validIntents.find(
				(intent) => String(intent._id) === sealedState.leaderIntentId,
			);
			if (winnerIntent) {
				winnerSponsorId = winnerIntent.sponsorId;
				winningBidId = winnerIntent._id;
				settlementAmountCents = sealedState.settlementBidCents;
			}
		}
	} else {
		let leaderId = auction.currentLeaderSponsorId;
		let settlement = auction.currentPriceCents ?? auction.startPriceCents;
		if (!leaderId && validIntents.length > 0) {
			const latestBySponsor = new Map<
				Id<"sponsors">,
				Doc<"sponsorshipBidIntents">
			>();
			const firstSeen = new Map<Id<"sponsors">, Doc<"sponsorshipBidIntents">>();
			for (const intent of validIntents) {
				const existingFirst = firstSeen.get(intent.sponsorId);
				if (
					!existingFirst ||
					compareIntentChronology(intent, existingFirst) < 0
				) {
					firstSeen.set(intent.sponsorId, intent);
				}
				const existingLatest = latestBySponsor.get(intent.sponsorId);
				if (
					!existingLatest ||
					compareIntentChronology(intent, existingLatest) > 0
				) {
					latestBySponsor.set(intent.sponsorId, intent);
				}
			}
			const contenders = [...latestBySponsor.values()].map((intent) => ({
				sponsorId: intent.sponsorId,
				maxAmountCents: intent.maxAmountCents ?? intent.amountCents,
				firstMaxSetAt:
					firstSeen.get(intent.sponsorId)?.createdAt ?? intent.createdAt,
			}));
			const state = resolveProxyState(contenders, auction.startPriceCents);
			if (state) {
				leaderId = state.leaderSponsorId;
				settlement = state.currentPriceCents;
			}
		}

		if (leaderId) {
			winnerSponsorId = leaderId;
			settlementAmountCents = settlement;
			const winnerLatestIntent = validIntents
				.filter((intent) => intent.sponsorId === winnerSponsorId)
				.sort((a, b) => compareIntentChronology(b, a))[0];
			winningBidId = winnerLatestIntent?._id;
		}
	}

	await ctx.db.patch("sponsorshipAuctions", auction._id, {
		state: "closed",
		winnerSponsorId,
		winningBidId,
		settlementAmountCents,
		updatedAt: Date.now(),
	});

	const closedAuction = await ctx.db.get("sponsorshipAuctions", auction._id);
	if (closedAuction) {
		await sendAuctionClosureEmails(ctx, closedAuction);
	}
}

export const start = mutation({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorshipManager(ctx);
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		if (auction.state === "closed") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Closed auctions cannot be started.",
			});
		}
		const now = Date.now();
		const targetState = resolveAuctionStartTargetState({
			state: auction.state,
			startsAt: auction.startsAt,
			now,
		});
		if (targetState === "noop") {
			await syncLifecycleRuntimeCron(ctx);
			return null;
		}

		const competition = await ctx.db.get("competitions", auction.competitionId);
		if (!competition?.wcaCompetitionId) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"Competition must be linked to a WCA competition before starting sponsorship.",
			});
		}
		await cacheCompetitionFallbackSnapshot(ctx, { auction, competition });
		if (auction.competitionSnapshot?.source !== "wca") {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"Competition details are not synced from WCA yet. Refresh competition data before opening.",
			});
		}
		await requireNoOpenAuctionForCompetition(
			ctx,
			auction.competitionId,
			auction._id,
		);
		const readinessSnapshot = await buildReadinessSnapshot(competition);

		await ctx.db.patch("sponsorshipAuctions", auction._id, {
			state: targetState,
			updatedById: actorId,
			updatedAt: now,
			readinessSnapshotJson: JSON.stringify(readinessSnapshot),
		});

		if (targetState === "scheduled") {
			const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id);
			if (refreshed) {
				await sendAuctionScheduledEmails(ctx, refreshed);
			}
		}
		if (targetState === "active") {
			const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id);
			if (refreshed) {
				await sendAuctionStartedEmails(ctx, refreshed);
			}
		}
		await scheduleCompetitionSnapshotRefresh(ctx, auction._id);
		await syncLifecycleRuntimeCron(ctx);
		return null;
	},
});

export const close = mutation({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireSponsorshipManager(ctx);
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		const competition = await ctx.db.get("competitions", auction.competitionId);
		if (competition) {
			await cacheCompetitionFallbackSnapshot(ctx, { auction, competition });
		}
		await closeAuctionInternal(ctx, auction);
		await scheduleCompetitionSnapshotRefresh(ctx, auction._id);
		await syncLifecycleRuntimeCron(ctx);
		return null;
	},
});

export const _tickLifecycle = internalMutation({
	args: {},
	returns: v.object({
		activated: v.number(),
		closed: v.number(),
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const scheduled = await ctx.db
			.query("sponsorshipAuctions")
			.withIndex("by_state_and_start", (q) =>
				q.eq("state", "scheduled").lte("startsAt", now),
			)
			.collect();
		let activated = 0;
		for (const auction of scheduled) {
			await ctx.db.patch("sponsorshipAuctions", auction._id, {
				state: "active",
				updatedAt: now,
			});
			const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id);
			if (refreshed) {
				await sendAuctionStartedEmails(ctx, refreshed);
			}
			activated += 1;
		}

		const activeToClose = await ctx.db
			.query("sponsorshipAuctions")
			.withIndex("by_state_and_end", (q) =>
				q.eq("state", "active").lte("endsAt", now),
			)
			.collect();
		let closed = 0;
		for (const auction of activeToClose) {
			await closeAuctionInternal(ctx, auction);
			closed += 1;
		}
		await syncLifecycleRuntimeCron(ctx);
		return { activated, closed };
	},
});

export const _syncLifecycleRuntimeCron = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await syncLifecycleRuntimeCron(ctx);
		return null;
	},
});
