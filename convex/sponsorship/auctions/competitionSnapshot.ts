import { ConvexError, v } from "convex/values";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	type ActionCtx,
	type MutationCtx,
} from "../../_generated/server";
import {
	buildCompetitionRecordSummary,
	buildCompetitionSnapshot,
	buildWcaCompetitionSummary,
	sponsorshipCompetitionSnapshot,
	sponsorshipCompetitionSummary,
	sponsorshipCompetitionSummarySource,
	type SponsorshipCompetitionSummary,
	type SponsorshipCompetitionSnapshot,
} from "../../lib/sponsorshipCompetitionSnapshot";

const competitionSnapshotRefreshStatus = v.union(
	v.literal("ready"),
	v.literal("missing_wca_link"),
	v.literal("fetch_failed"),
	v.literal("not_found"),
);

const competitionSnapshotRefreshResult = v.object({
	status: competitionSnapshotRefreshStatus,
	message: v.string(),
	summary: v.optional(sponsorshipCompetitionSummary),
	summarySource: v.optional(sponsorshipCompetitionSummarySource),
	fetchedAt: v.optional(v.number()),
});

const auctionSnapshotContext = v.object({
	auctionId: v.id("sponsorshipAuctions"),
	competitionName: v.string(),
	competitionCompStart: v.string(),
	competitionCompEnd: v.string(),
	wcaCompetitionId: v.optional(v.string()),
	competitionSnapshot: v.optional(sponsorshipCompetitionSnapshot),
});

function buildFallbackSnapshotFromContext(context: {
	competitionName: string;
	competitionCompStart: string;
	competitionCompEnd: string;
}): SponsorshipCompetitionSnapshot {
	return buildCompetitionSnapshot({
		summary: buildCompetitionRecordSummary({
			name: context.competitionName,
			compStart: context.competitionCompStart,
			compEnd: context.competitionCompEnd,
		}),
		source: "competition_record",
	});
}

export function buildFallbackSnapshotForCompetition(
	competition: Pick<Doc<"competitions">, "name" | "compStart" | "compEnd">,
): SponsorshipCompetitionSnapshot {
	return buildCompetitionSnapshot({
		summary: buildCompetitionRecordSummary(competition),
		source: "competition_record",
	});
}

export async function cacheCompetitionFallbackSnapshot(
	ctx: MutationCtx,
	input: {
		auction: Doc<"sponsorshipAuctions">;
		competition: Doc<"competitions">;
	},
): Promise<void> {
	if (input.auction.competitionSnapshot?.source === "wca") {
		return;
	}
	await ctx.db.patch("sponsorshipAuctions", input.auction._id, {
		competitionSnapshot: buildFallbackSnapshotForCompetition(input.competition),
	});
}

export async function scheduleCompetitionSnapshotRefresh(
	ctx: MutationCtx,
	auctionId: Id<"sponsorshipAuctions">,
): Promise<void> {
	await ctx.scheduler.runAfter(
		0,
		internal.sponsorshipAuctions.refreshCompetitionSnapshotInternal,
		{ auctionId },
	);
}

export const getSnapshotContextInternal = internalQuery({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.union(auctionSnapshotContext, v.null()),
	handler: async (ctx, args) => {
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		const competition = await ctx.db.get("competitions", auction.competitionId);
		if (!competition) return null;
		return {
			auctionId: auction._id,
			competitionName: competition.name,
			competitionCompStart: competition.compStart,
			competitionCompEnd: competition.compEnd,
			wcaCompetitionId: competition.wcaCompetitionId,
			competitionSnapshot: auction.competitionSnapshot,
		};
	},
});

export const setSnapshotInternal = internalMutation({
	args: {
		auctionId: v.id("sponsorshipAuctions"),
		snapshot: sponsorshipCompetitionSnapshot,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch("sponsorshipAuctions", args.auctionId, {
			competitionSnapshot: args.snapshot,
		});
		return null;
	},
});

async function runCompetitionSnapshotRefresh(
	ctx: ActionCtx,
	auctionId: Id<"sponsorshipAuctions">,
): Promise<{
	status: "ready" | "missing_wca_link" | "fetch_failed" | "not_found";
	message: string;
	summary?: SponsorshipCompetitionSummary;
	summarySource?: "competition_record" | "wca";
	fetchedAt?: number;
}> {
	const context = await ctx.runQuery(
		internal.sponsorshipAuctions.getSnapshotContextInternal,
		{ auctionId },
	);
	if (!context) {
		return {
			status: "not_found",
			message: "Auction not found.",
		};
	}

	if (!context.wcaCompetitionId) {
		const fallbackSnapshot = context.competitionSnapshot
			? context.competitionSnapshot
			: buildFallbackSnapshotFromContext(context);
		if (!context.competitionSnapshot) {
			await ctx.runMutation(internal.sponsorshipAuctions.setSnapshotInternal, {
				auctionId: context.auctionId,
				snapshot: fallbackSnapshot,
			});
		}
		return {
			status: "missing_wca_link",
			message: "Competition is not linked to WCA.",
			summary: fallbackSnapshot.summary,
			summarySource: fallbackSnapshot.source,
			fetchedAt: fallbackSnapshot.fetchedAt,
		};
	}

	const details = await ctx.runAction(
		internal.wca.fetchCompetitionDetailsInternal,
		{
			wcaCompetitionId: context.wcaCompetitionId,
		},
	);
	if (!details) {
		if (context.competitionSnapshot?.source === "wca") {
			return {
				status: "ready",
				message: "Using the latest cached WCA competition summary.",
				summary: context.competitionSnapshot.summary,
				summarySource: context.competitionSnapshot.source,
				fetchedAt: context.competitionSnapshot.fetchedAt,
			};
		}
		const fallbackSnapshot = context.competitionSnapshot
			? context.competitionSnapshot
			: buildFallbackSnapshotFromContext(context);
		if (!context.competitionSnapshot) {
			await ctx.runMutation(internal.sponsorshipAuctions.setSnapshotInternal, {
				auctionId: context.auctionId,
				snapshot: fallbackSnapshot,
			});
		}
		return {
			status: "fetch_failed",
			message:
				"Could not fetch WCA competition details right now. Try again in a moment.",
			summary: fallbackSnapshot.summary,
			summarySource: fallbackSnapshot.source,
			fetchedAt: fallbackSnapshot.fetchedAt,
		};
	}

	const snapshot = buildCompetitionSnapshot({
		summary: buildWcaCompetitionSummary(details),
		source: "wca",
	});
	await ctx.runMutation(internal.sponsorshipAuctions.setSnapshotInternal, {
		auctionId: context.auctionId,
		snapshot,
	});
	return {
		status: "ready",
		message: "Competition details synced from WCA.",
		summary: snapshot.summary,
		summarySource: snapshot.source,
		fetchedAt: snapshot.fetchedAt,
	};
}

async function authorizeSnapshotRefresh(
	ctx: ActionCtx,
	args: {
		auctionId: Id<"sponsorshipAuctions">;
		sessionToken?: string;
	},
): Promise<void> {
	const isManager = await ctx.runQuery(
		api.sponsors.isSponsorshipManagerQuery,
		{},
	);
	if (isManager) return;

	if (!args.sessionToken) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Sponsorship manager access is required.",
		});
	}

	try {
		await ctx.runQuery(api.sponsorPortal.getAuction, {
			sessionToken: args.sessionToken,
			auctionId: args.auctionId,
		});
	} catch {
		throw new ConvexError({
			code: "FORBIDDEN",
			message:
				"You do not have access to refresh this auction competition data.",
		});
	}
}

export const refreshCompetitionSnapshot = action({
	args: {
		auctionId: v.id("sponsorshipAuctions"),
		sessionToken: v.optional(v.string()),
	},
	returns: competitionSnapshotRefreshResult,
	handler: async (ctx, args) => {
		await authorizeSnapshotRefresh(ctx, args);
		return await runCompetitionSnapshotRefresh(ctx, args.auctionId);
	},
});

export const refreshCompetitionSnapshotInternal = internalAction({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: competitionSnapshotRefreshResult,
	handler: async (ctx, args) => {
		return await runCompetitionSnapshotRefresh(ctx, args.auctionId);
	},
});
