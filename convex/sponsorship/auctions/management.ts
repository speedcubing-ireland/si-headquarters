import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireSponsorshipManager } from "../../lib/sponsorshipAccess";
import { sponsorshipAuctionFramework } from "../../lib/sponsorshipValidators";
import {
	auctionForManager,
	auctionTableRowForManager,
	competitionForSponsorshipManager,
	DEFAULT_SCHEDULE_WINDOW_MS,
	replaceAuctionInvites,
	requireNoOpenAuctionForCompetition,
	toManagerAuction,
} from "./shared";
import { syncLifecycleRuntimeCron } from "./runtimeCron";

export const create = mutation({
	args: {
		competitionId: v.id("competitions"),
		framework: v.optional(sponsorshipAuctionFramework),
		startsAt: v.number(),
		endsAt: v.number(),
		currency: v.optional(v.string()),
		antiSnipingWindowMs: v.optional(v.number()),
		antiSnipingExtendMs: v.optional(v.number()),
		startPriceCents: v.number(),
		invitedSponsorIds: v.array(v.id("sponsors")),
	},
	returns: v.id("sponsorshipAuctions"),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorshipManager(ctx);
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Competition not found.",
			});
		}
		if (args.endsAt <= args.startsAt) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Auction end must be after start.",
			});
		}
		if (args.startPriceCents < 100) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Start price must be at least EUR 1.00.",
			});
		}
		await requireNoOpenAuctionForCompetition(ctx, args.competitionId);

		const now = Date.now();
		const auctionId = await ctx.db.insert("sponsorshipAuctions", {
			competitionId: args.competitionId,
			framework: args.framework ?? "first_sealed",
			state: "draft",
			currency: args.currency ?? "EUR",
			startsAt: args.startsAt,
			endsAt: args.endsAt,
			antiSnipingWindowMs:
				args.antiSnipingWindowMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
			antiSnipingExtendMs:
				args.antiSnipingExtendMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
			startPriceCents: args.startPriceCents,
			createdById: actorId,
			updatedById: actorId,
			updatedAt: now,
		});

		await replaceAuctionInvites(ctx, {
			auctionId,
			sponsorIds: args.invitedSponsorIds,
			actorId,
		});

		return auctionId;
	},
});

export const removeBeforeOpen = mutation({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireSponsorshipManager(ctx);
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		if (auction.state === "active" || auction.state === "closed") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message:
					"Only draft or scheduled auctions can be deleted before opening.",
			});
		}

		const [invites, intents, events, emailDispatches, deadLetters] =
			await Promise.all([
				ctx.db
					.query("sponsorshipAuctionInvites")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
				ctx.db
					.query("sponsorshipBidIntents")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
				ctx.db
					.query("sponsorshipBidEvents")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
				ctx.db
					.query("sponsorshipEmailDispatches")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
				ctx.db
					.query("sponsorshipEmailDeadLetters")
					.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
					.collect(),
			]);

		await Promise.all([
			...invites.map((invite) =>
				ctx.db.delete("sponsorshipAuctionInvites", invite._id),
			),
			...intents.map((intent) =>
				ctx.db.delete("sponsorshipBidIntents", intent._id),
			),
			...events.map((event) =>
				ctx.db.delete("sponsorshipBidEvents", event._id),
			),
			...emailDispatches.map((dispatch) =>
				ctx.db.delete("sponsorshipEmailDispatches", dispatch._id),
			),
			...deadLetters.map((deadLetter) =>
				ctx.db.delete("sponsorshipEmailDeadLetters", deadLetter._id),
			),
		]);
		const scheduledFunctionIds = [
			...new Set(
				emailDispatches
					.map((dispatch) => dispatch.scheduledFunctionId)
					.filter(
						(scheduledId): scheduledId is Id<"_scheduled_functions"> =>
							scheduledId !== undefined,
					),
			),
		];
		await Promise.all(
			scheduledFunctionIds.map((scheduledId) =>
				ctx.scheduler.cancel(scheduledId),
			),
		);
		await ctx.db.delete("sponsorshipAuctions", auction._id);
		await syncLifecycleRuntimeCron(ctx);
		return null;
	},
});

export const update = mutation({
	args: {
		auctionId: v.id("sponsorshipAuctions"),
		framework: v.optional(sponsorshipAuctionFramework),
		startsAt: v.optional(v.number()),
		endsAt: v.optional(v.number()),
		startPriceCents: v.optional(v.number()),
		invitedSponsorIds: v.optional(v.array(v.id("sponsors"))),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const actorId = await requireSponsorshipManager(ctx);
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		if (auction.state === "closed") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Closed auctions cannot be edited.",
			});
		}
		if (
			auction.state === "active" &&
			(args.framework !== undefined ||
				args.startsAt !== undefined ||
				args.endsAt !== undefined ||
				args.startPriceCents !== undefined ||
				args.invitedSponsorIds !== undefined)
		) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message:
					"Active auctions cannot be edited. Use close and relaunch if changes are required.",
			});
		}

		const patch: Partial<Doc<"sponsorshipAuctions">> = {
			updatedById: actorId,
			updatedAt: Date.now(),
		};
		if (args.framework !== undefined) patch.framework = args.framework;
		if (args.startsAt !== undefined) patch.startsAt = args.startsAt;
		if (args.endsAt !== undefined) patch.endsAt = args.endsAt;
		if (args.startPriceCents !== undefined) {
			patch.startPriceCents = args.startPriceCents;
		}
		const nextStartsAt = patch.startsAt ?? auction.startsAt;
		const nextEndsAt = patch.endsAt ?? auction.endsAt;
		if (nextEndsAt <= nextStartsAt) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Auction end must be after start.",
			});
		}
		if (patch.startPriceCents !== undefined && patch.startPriceCents < 100) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Start price must be at least EUR 1.00.",
			});
		}

		await ctx.db.patch("sponsorshipAuctions", auction._id, patch);
		if (args.invitedSponsorIds !== undefined) {
			await replaceAuctionInvites(ctx, {
				auctionId: auction._id,
				sponsorIds: args.invitedSponsorIds,
				actorId,
			});
		}

		return null;
	},
});

export const listByCompetition = query({
	args: { competitionId: v.id("competitions") },
	returns: v.array(auctionForManager),
	handler: async (ctx, args) => {
		await requireSponsorshipManager(ctx);
		const auctions = await ctx.db
			.query("sponsorshipAuctions")
			.withIndex("by_competition", (q) =>
				q.eq("competitionId", args.competitionId),
			)
			.collect();
		return auctions
			.sort((a, b) => b.startsAt - a.startsAt)
			.map((auction) => toManagerAuction(auction));
	},
});

export const listCompetitionsForManager = query({
	args: {},
	returns: v.array(competitionForSponsorshipManager),
	handler: async (ctx) => {
		await requireSponsorshipManager(ctx);
		const competitions = await ctx.db
			.query("competitions")
			.withIndex("by_comp_start")
			.order("asc")
			.collect();
		if (competitions.length === 0) return [];

		const phaseIds = [
			...new Set(
				competitions
					.map((competition) => competition.currentPhaseId)
					.filter((phaseId): phaseId is Id<"phases"> => phaseId !== undefined),
			),
		];
		const [phases, auctions] = await Promise.all([
			Promise.all(phaseIds.map((phaseId) => ctx.db.get("phases", phaseId))),
			ctx.db.query("sponsorshipAuctions").collect(),
		]);
		const phaseNameById = new Map<Id<"phases">, string>();
		for (const phase of phases) {
			if (!phase) continue;
			phaseNameById.set(phase._id, phase.name);
		}
		const auctionsByCompetition = new Map<
			Id<"competitions">,
			Doc<"sponsorshipAuctions">[]
		>();
		for (const auction of auctions) {
			const current = auctionsByCompetition.get(auction.competitionId) ?? [];
			current.push(auction);
			auctionsByCompetition.set(auction.competitionId, current);
		}

		return competitions.map((competition) => {
			const scopedAuctions = auctionsByCompetition.get(competition._id) ?? [];
			const hasClosedWinner = scopedAuctions.some(
				(auction) =>
					auction.state === "closed" && auction.winnerSponsorId !== undefined,
			);
			return {
				id: competition._id,
				name: competition.name,
				compStart: competition.compStart,
				compEnd: competition.compEnd,
				wcaCompetitionId: competition.wcaCompetitionId,
				currentPhaseName: competition.currentPhaseId
					? (phaseNameById.get(competition.currentPhaseId) ?? "Unknown phase")
					: "No phase",
				sponsorPropertyStatus: resolveCompetitionSponsorStatus({
					auctionStates: scopedAuctions.map((auction) => auction.state),
					hasClosedWinner,
				}),
			};
		});
	},
});

function resolveCompetitionSponsorStatus(input: {
	auctionStates: Doc<"sponsorshipAuctions">["state"][];
	hasClosedWinner: boolean;
}): "not_offered" | "bidding" | "none" | "sponsor" {
	if (input.auctionStates.some((state) => state !== "closed")) {
		return "bidding";
	}
	if (input.hasClosedWinner) {
		return "sponsor";
	}
	return input.auctionStates.length > 0 ? "none" : "not_offered";
}

export const listForManager = query({
	args: {},
	returns: v.array(auctionTableRowForManager),
	handler: async (ctx) => {
		await requireSponsorshipManager(ctx);
		const auctions = await ctx.db.query("sponsorshipAuctions").collect();
		if (auctions.length === 0) return [];

		const competitionIds = [
			...new Set(auctions.map((auction) => auction.competitionId)),
		];
		const competitions = await Promise.all(
			competitionIds.map((competitionId) =>
				ctx.db.get("competitions", competitionId),
			),
		);
		const competitionById = new Map<Id<"competitions">, Doc<"competitions">>();
		const phaseIds = new Set<Id<"phases">>();
		for (const competition of competitions) {
			if (!competition) continue;
			competitionById.set(competition._id, competition);
			if (competition.currentPhaseId) {
				phaseIds.add(competition.currentPhaseId);
			}
		}

		const phases = await Promise.all(
			[...phaseIds].map((phaseId) => ctx.db.get("phases", phaseId)),
		);
		const phaseNameById = new Map<Id<"phases">, string>();
		for (const phase of phases) {
			if (!phase) continue;
			phaseNameById.set(phase._id, phase.name);
		}
		const auctionsByCompetition = new Map<
			Id<"competitions">,
			Doc<"sponsorshipAuctions">[]
		>();
		for (const auction of auctions) {
			const current = auctionsByCompetition.get(auction.competitionId) ?? [];
			current.push(auction);
			auctionsByCompetition.set(auction.competitionId, current);
		}

		const statusByCompetition = new Map<
			Id<"competitions">,
			"not_offered" | "bidding" | "none" | "sponsor"
		>();
		for (const competitionId of competitionIds) {
			const scopedAuctions = auctionsByCompetition.get(competitionId) ?? [];
			const hasClosedWinner = scopedAuctions.some(
				(auction) =>
					auction.state === "closed" && auction.winnerSponsorId !== undefined,
			);
			statusByCompetition.set(
				competitionId,
				resolveCompetitionSponsorStatus({
					auctionStates: scopedAuctions.map((auction) => auction.state),
					hasClosedWinner,
				}),
			);
		}

		return auctions
			.map((auction) => {
				const competition = competitionById.get(auction.competitionId);
				if (!competition) return null;
				return {
					id: auction._id,
					competitionId: auction.competitionId,
					competitionName: competition.name,
					competitionCompStart: competition.compStart,
					competitionPhaseName: competition.currentPhaseId
						? (phaseNameById.get(competition.currentPhaseId) ?? "Unknown phase")
						: "No phase",
					competitionSponsorStatus:
						statusByCompetition.get(competition._id) ?? "not_offered",
					framework: auction.framework,
					state: auction.state,
					currency: auction.currency,
					startsAt: auction.startsAt,
					endsAt: auction.endsAt,
					startPriceCents: auction.startPriceCents,
					currentPriceCents: auction.currentPriceCents,
					currentLeaderSponsorId: auction.currentLeaderSponsorId,
					winnerSponsorId: auction.winnerSponsorId,
					settlementAmountCents: auction.settlementAmountCents,
					updatedAt: auction.updatedAt,
				};
			})
			.filter((row): row is NonNullable<typeof row> => Boolean(row))
			.sort((a, b) => {
				if (a.state === "closed" && b.state !== "closed") return 1;
				if (a.state !== "closed" && b.state === "closed") return -1;
				return b.startsAt - a.startsAt;
			});
	},
});

export const getManagerView = query({
	args: { auctionId: v.id("sponsorshipAuctions") },
	returns: v.union(
		v.object({
			auction: auctionForManager,
			inviteSponsorIds: v.array(v.id("sponsors")),
			intentCount: v.number(),
			eventCount: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		await requireSponsorshipManager(ctx);
		const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId);
		if (!auction) return null;
		const [invites, intents, events] = await Promise.all([
			ctx.db
				.query("sponsorshipAuctionInvites")
				.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
				.collect(),
			ctx.db
				.query("sponsorshipBidIntents")
				.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
				.collect(),
			ctx.db
				.query("sponsorshipBidEvents")
				.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
				.collect(),
		]);

		return {
			auction: toManagerAuction(auction),
			inviteSponsorIds: invites.map((invite) => invite.sponsorId),
			intentCount: intents.length,
			eventCount: events.length,
		};
	},
});
