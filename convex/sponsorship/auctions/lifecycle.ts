import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requireSponsorshipManager } from "../../lib/sponsorshipAccess";
import { resolveAuctionOutcome } from "../../lib/sponsorshipAuctionState";
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
	sendAuctionActiveReminderEmail,
	sendAuctionClosureEmails,
	sendAuctionScheduledEmails,
	sendAuctionStartedEmails,
} from "./emails";
import {
	markReminderSent,
	markReminderSkipped,
	scheduleAuctionActiveRemindersOnActivation,
} from "./reminders";

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
	const { settlementAmountCents, winnerSponsorId, winningBidId } =
		resolveAuctionOutcome({
			auction,
			validIntents,
		});

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

async function cancelScheduledOptional(
	ctx: MutationCtx,
	id: Id<"_scheduled_functions"> | undefined,
): Promise<void> {
	if (!id) return;
	try {
		await ctx.scheduler.cancel(id);
	} catch {
		// Already completed or invalid
	}
}

/** Schedule (or replace) activation at `auction.startsAt`. */
export async function scheduleAuctionActivation(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	await cancelScheduledOptional(ctx, auction.activationScheduledFunctionId);
	const scheduledFunctionId = await ctx.scheduler.runAt(
		Math.max(auction.startsAt, Date.now()),
		internal.sponsorshipAuctions._activateAuction,
		{ auctionId: auction._id },
	);
	await ctx.db.patch("sponsorshipAuctions", auction._id, {
		activationScheduledFunctionId: scheduledFunctionId,
		updatedAt: Date.now(),
	});
}

/** Schedule (or replace) automatic close at `auction.endsAt`. */
export async function scheduleAuctionClosure(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	await cancelScheduledOptional(ctx, auction.closureScheduledFunctionId);
	const scheduledFunctionId = await ctx.scheduler.runAt(
		Math.max(auction.endsAt, Date.now()),
		internal.sponsorshipAuctions._closeAuction,
		{ auctionId: auction._id },
	);
	await ctx.db.patch("sponsorshipAuctions", auction._id, {
		closureScheduledFunctionId: scheduledFunctionId,
		updatedAt: Date.now(),
	});
}

export const _activateAuction = internalMutation({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		if (auction.state !== "scheduled") return null;
		const now = Date.now();
		if (auction.startsAt > now) return null;

		await ctx.db.patch("sponsorshipAuctions", auction._id, {
			state: "active",
			updatedAt: now,
		});
		const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id);
		if (!refreshed) return null;

		await sendAuctionStartedEmails(ctx, refreshed);
		await scheduleAuctionActiveRemindersOnActivation(ctx, refreshed);
		await scheduleAuctionClosure(ctx, refreshed);
		return null;
	},
});

export const _closeAuction = internalMutation({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		if (auction.state !== "active") return null;
		const now = Date.now();
		if (auction.endsAt > now) return null;

		await closeAuctionInternal(ctx, auction);
		return null;
	},
});

export const _fireReminder = internalMutation({
	args: { reminderId: v.id("sponsorshipAuctionReminders") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const reminder = await ctx.db.get(
			"sponsorshipAuctionReminders",
			args.reminderId,
		);
		if (!reminder || reminder.sent) return null;
		const now = Date.now();
		if (reminder.scheduledFor > now) return null;

		const [reminderAuction, sponsor] = await Promise.all([
			ctx.db.get("sponsorshipAuctions", reminder.auctionId),
			ctx.db.get("sponsors", reminder.sponsorId),
		]);
		if (
			!reminderAuction ||
			reminderAuction.state !== "active" ||
			!sponsor?.active
		) {
			await markReminderSkipped(ctx, reminder._id);
			return null;
		}
		if (now >= reminderAuction.endsAt) {
			await markReminderSkipped(ctx, reminder._id);
			return null;
		}
		await sendAuctionActiveReminderEmail(ctx, reminderAuction, sponsor);
		await markReminderSent(ctx, reminder._id);
		return null;
	},
});

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
				await scheduleAuctionActivation(ctx, refreshed);
			}
		}
		if (targetState === "active") {
			const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id);
			if (refreshed) {
				await sendAuctionStartedEmails(ctx, refreshed);
				await scheduleAuctionActiveRemindersOnActivation(ctx, refreshed);
				await scheduleAuctionClosure(ctx, refreshed);
			}
		}
		await scheduleCompetitionSnapshotRefresh(ctx, auction._id);
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
		await cancelScheduledOptional(ctx, auction.activationScheduledFunctionId);
		await cancelScheduledOptional(ctx, auction.closureScheduledFunctionId);
		await closeAuctionInternal(ctx, auction);
		await scheduleCompetitionSnapshotRefresh(ctx, auction._id);
		return null;
	},
});
