import { collectAll } from "@/convex/utils"
import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { compareBidIntentChronologyWithIdTieBreak } from "../../lib/auctionState"
import { competitionStartEnd } from "@/convex/competitions/dates"
import { sponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/validators"
import {
  resolveCompetitionSummaryView,
  sponsorshipCompetitionSummary,
  sponsorshipCompetitionSummarySource,
} from "../../lib/competitionSnapshot"
import {
  auctionForManager,
  auctionTableRowForManager,
  competitionForSponsorshipManager,
  DEFAULT_SCHEDULE_WINDOW_MS,
  replaceAuctionInvites,
  requireNoOpenAuctionForCompetition,
  toManagerAuction,
} from "./shared"
import {
  buildFallbackSnapshotForCompetition,
  scheduleCompetitionSnapshotRefresh,
} from "./competitionSnapshot"
import { scheduleAuctionActivation } from "./lifecycle"
import { buildCompetitionSponsorStatusByCompetition } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import { getCompetitionSponsorOverridesByCompetitionId } from "@/convex/plugins/sponsor/lib/competitionSponsorOverrides"

function normalizePositiveDurationMs(
  fieldName: string,
  value: number | undefined
): number | undefined {
  if (value === undefined) return undefined
  const durationMs = Math.floor(value)
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `${fieldName} must be a positive whole number of milliseconds.`,
    })
  }
  return durationMs
}

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
    const actorId = await requireSponsorPortalAdmin(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (!competition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
    if (args.endsAt <= args.startsAt) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Auction end must be after start.",
      })
    }
    if (args.startPriceCents < 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Start price must be at least EUR 1.00.",
      })
    }
    const antiSnipingWindowMs = normalizePositiveDurationMs(
      "Anti-sniping window",
      args.antiSnipingWindowMs
    )
    const antiSnipingExtendMs = normalizePositiveDurationMs(
      "Anti-sniping extension",
      args.antiSnipingExtendMs
    )
    await requireNoOpenAuctionForCompetition(ctx, args.competitionId)

    const now = Date.now()
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      competitionId: args.competitionId,
      framework: args.framework ?? "first_sealed",
      state: "draft",
      currency: args.currency ?? "EUR",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      antiSnipingWindowMs: antiSnipingWindowMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
      antiSnipingExtendMs: antiSnipingExtendMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
      startPriceCents: args.startPriceCents,
      competitionSnapshot: buildFallbackSnapshotForCompetition(competition),
      createdById: actorId,
      updatedById: actorId,
      updatedAt: now,
    })

    await replaceAuctionInvites(ctx, {
      auctionId,
      sponsorIds: args.invitedSponsorIds,
      actorId,
    })
    await scheduleCompetitionSnapshotRefresh(ctx, auctionId)

    return auctionId
  },
})

export const removeBeforeOpen = mutation({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    if (auction.state === "active" || auction.state === "closed") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Only draft or scheduled auctions can be deleted before opening.",
      })
    }

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
    ])

    await Promise.all([
      ...invites.map((invite) =>
        ctx.db.delete("sponsorshipAuctionInvites", invite._id)
      ),
      ...intents.map((intent) =>
        ctx.db.delete("sponsorshipBidIntents", intent._id)
      ),
      ...events.map((event) =>
        ctx.db.delete("sponsorshipBidEvents", event._id)
      ),
    ])
    await ctx.db.delete("sponsorshipAuctions", auction._id)
    return null
  },
})

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
    const actorId = await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    const competition = await ctx.db.get("competitions", auction.competitionId)
    if (!competition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
    if (auction.state === "closed") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Closed auctions cannot be edited.",
      })
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
      })
    }

    const patch: Partial<Doc<"sponsorshipAuctions">> = {
      updatedById: actorId,
      updatedAt: Date.now(),
    }
    if (args.framework !== undefined) patch.framework = args.framework
    if (args.startsAt !== undefined) patch.startsAt = args.startsAt
    if (args.endsAt !== undefined) patch.endsAt = args.endsAt
    if (args.startPriceCents !== undefined) {
      patch.startPriceCents = args.startPriceCents
    }
    const nextStartsAt = patch.startsAt ?? auction.startsAt
    const nextEndsAt = patch.endsAt ?? auction.endsAt
    if (nextEndsAt <= nextStartsAt) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Auction end must be after start.",
      })
    }
    if (patch.startPriceCents !== undefined && patch.startPriceCents < 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Start price must be at least EUR 1.00.",
      })
    }

    await ctx.db.patch("sponsorshipAuctions", auction._id, patch)
    if (auction.competitionSnapshot?.source !== "wca") {
      await ctx.db.patch("sponsorshipAuctions", auction._id, {
        competitionSnapshot: buildFallbackSnapshotForCompetition(competition),
      })
    }
    if (args.invitedSponsorIds !== undefined) {
      await replaceAuctionInvites(ctx, {
        auctionId: auction._id,
        sponsorIds: args.invitedSponsorIds,
        actorId,
      })
    }
    await scheduleCompetitionSnapshotRefresh(ctx, auction._id)

    const updated = await ctx.db.get("sponsorshipAuctions", auction._id)
    if (updated?.state === "scheduled" && args.startsAt !== undefined) {
      await scheduleAuctionActivation(ctx, updated)
    }

    return null
  },
})

export const listByCompetition = query({
  args: { competitionId: v.id("competitions") },
  returns: v.array(auctionForManager),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const auctions = await ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", args.competitionId)
      )
      .collect()
    return auctions
      .sort((a, b) => b.startsAt - a.startsAt)
      .map((auction) => toManagerAuction(auction))
  },
})

export const listCompetitionsForManager = query({
  args: {},
  returns: v.array(competitionForSponsorshipManager),
  handler: async (ctx) => {
    await requireSponsorPortalAdmin(ctx)
    const competitions = [...(await collectAll(ctx, "competitions"))].sort(
      (left, right) =>
        (left.compDates.from ?? "").localeCompare(right.compDates.from ?? "")
    )
    if (competitions.length === 0) return []

    const phaseIds = [
      ...new Set(
        competitions
          .map((competition) => competition.phaseId)
          .filter((phaseId): phaseId is Id<"phases"> => phaseId !== null)
      ),
    ]
    const competitionIds = competitions.map((competition) => competition._id)
    const [phases, auctions, overridesByCompetitionId] = await Promise.all([
      Promise.all(phaseIds.map((phaseId) => ctx.db.get("phases", phaseId))),
      collectAll(ctx, "sponsorshipAuctions"),
      getCompetitionSponsorOverridesByCompetitionId(ctx, competitionIds),
    ])
    const phaseNameById = new Map<Id<"phases">, string>()
    for (const phase of phases) {
      if (!phase) continue
      phaseNameById.set(phase._id, phase.name)
    }
    const statusByCompetition = buildCompetitionSponsorStatusByCompetition({
      competitionIds,
      auctions,
      overridesByCompetitionId,
    })

    return competitions.map((competition) => {
      const override = overridesByCompetitionId.get(competition._id) ?? null
      const { compStart, compEnd } = competitionStartEnd(competition)
      return {
        id: competition._id,
        name: competition.name,
        compStart,
        compEnd,
        wcaCompetitionId: competition.wcaCompetitionId,
        currentPhaseName: competition.phaseId
          ? (phaseNameById.get(competition.phaseId) ?? "Unknown phase")
          : "No phase",
        sponsorPropertyStatus:
          statusByCompetition.get(competition._id) ?? "not_offered",
        manualSponsorPropertyStatus: override?.manualSponsorPropertyStatus,
        manualSponsorId: override?.manualSponsorId,
      }
    })
  },
})

export const listForManager = query({
  args: {},
  returns: v.array(auctionTableRowForManager),
  handler: async (ctx) => {
    await requireSponsorPortalAdmin(ctx)
    const auctions = await collectAll(ctx, "sponsorshipAuctions")
    if (auctions.length === 0) return []

    const competitionIds = [
      ...new Set(auctions.map((auction) => auction.competitionId)),
    ]
    const [competitions, overridesByCompetitionId] = await Promise.all([
      Promise.all(
        competitionIds.map((competitionId) =>
          ctx.db.get("competitions", competitionId)
        )
      ),
      getCompetitionSponsorOverridesByCompetitionId(ctx, competitionIds),
    ])
    const competitionById = new Map<Id<"competitions">, Doc<"competitions">>()
    const phaseIds = new Set<Id<"phases">>()
    for (const competition of competitions) {
      if (!competition) continue
      competitionById.set(competition._id, competition)
      if (competition.phaseId) {
        phaseIds.add(competition.phaseId)
      }
    }

    const phases = await Promise.all(
      [...phaseIds].map((phaseId) => ctx.db.get("phases", phaseId))
    )
    const phaseNameById = new Map<Id<"phases">, string>()
    for (const phase of phases) {
      if (!phase) continue
      phaseNameById.set(phase._id, phase.name)
    }
    const statusByCompetition = buildCompetitionSponsorStatusByCompetition({
      competitionIds,
      auctions,
      overridesByCompetitionId,
    })

    return auctions
      .map((auction) => {
        const competition = competitionById.get(auction.competitionId)
        if (!competition) return null
        const { compStart: competitionCompStart } =
          competitionStartEnd(competition)
        return {
          id: auction._id,
          competitionId: auction.competitionId,
          competitionName: competition.name,
          competitionCompStart,
          competitionPhaseName: competition.phaseId
            ? (phaseNameById.get(competition.phaseId) ?? "Unknown phase")
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
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => {
        if (a.state === "closed" && b.state !== "closed") return 1
        if (a.state !== "closed" && b.state === "closed") return -1
        return b.startsAt - a.startsAt
      })
  },
})

export const getManagerView = query({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.union(
    v.object({
      auction: auctionForManager,
      competitionSummary: sponsorshipCompetitionSummary,
      competitionSummarySource: sponsorshipCompetitionSummarySource,
      competitionSummaryFetchedAt: v.optional(v.number()),
      competitionWcaCompetitionId: v.optional(v.string()),
      inviteSponsorIds: v.array(v.id("sponsors")),
      intentCount: v.number(),
      eventCount: v.number(),
      sponsorOutcomes: v.array(
        v.object({
          sponsorId: v.id("sponsors"),
          isInvited: v.boolean(),
          isWinner: v.boolean(),
          totalBidCount: v.number(),
          validBidCount: v.number(),
          latestValidBidCents: v.optional(v.number()),
          latestValidBidAt: v.optional(v.number()),
          latestValidBidMode: v.optional(
            v.union(v.literal("manual"), v.literal("proxy"))
          ),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    const [competition, invites, intents, events] = await Promise.all([
      ctx.db.get("competitions", auction.competitionId),
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
    ])
    if (!competition) return null
    const {
      summary: competitionSummary,
      source: competitionSummarySource,
      fetchedAt: competitionSummaryFetchedAt,
    } = resolveCompetitionSummaryView(auction.competitionSnapshot, competition)
    const inviteSponsorIds = invites.map((invite) => invite.sponsorId)
    const invitedSponsorSet = new Set<Id<"sponsors">>(inviteSponsorIds)
    const totalBidCountBySponsor = new Map<Id<"sponsors">, number>()
    const validBidCountBySponsor = new Map<Id<"sponsors">, number>()
    const latestValidIntentBySponsor = new Map<
      Id<"sponsors">,
      Doc<"sponsorshipBidIntents">
    >()
    for (const intent of intents) {
      totalBidCountBySponsor.set(
        intent.sponsorId,
        (totalBidCountBySponsor.get(intent.sponsorId) ?? 0) + 1
      )
      if (!intent.isValid) continue
      validBidCountBySponsor.set(
        intent.sponsorId,
        (validBidCountBySponsor.get(intent.sponsorId) ?? 0) + 1
      )
      const latestIntent = latestValidIntentBySponsor.get(intent.sponsorId)
      if (
        !latestIntent ||
        compareBidIntentChronologyWithIdTieBreak(intent, latestIntent) > 0
      ) {
        latestValidIntentBySponsor.set(intent.sponsorId, intent)
      }
    }
    const outcomeSponsorIds = new Set<Id<"sponsors">>(inviteSponsorIds)
    for (const intent of intents) {
      outcomeSponsorIds.add(intent.sponsorId)
    }
    const sponsorOutcomes = [...outcomeSponsorIds]
      .map((sponsorId) => {
        const latestValidIntent = latestValidIntentBySponsor.get(sponsorId)
        return {
          sponsorId,
          isInvited: invitedSponsorSet.has(sponsorId),
          isWinner: auction.winnerSponsorId === sponsorId,
          totalBidCount: totalBidCountBySponsor.get(sponsorId) ?? 0,
          validBidCount: validBidCountBySponsor.get(sponsorId) ?? 0,
          latestValidBidCents: latestValidIntent?.amountCents,
          latestValidBidAt: latestValidIntent?.createdAt,
          latestValidBidMode: latestValidIntent?.mode,
        }
      })
      .sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1
        if (!a.isWinner && b.isWinner) return 1
        const aBid = a.latestValidBidCents ?? -1
        const bBid = b.latestValidBidCents ?? -1
        if (aBid !== bBid) return bBid - aBid
        if (a.validBidCount !== b.validBidCount) {
          return b.validBidCount - a.validBidCount
        }
        if (a.totalBidCount !== b.totalBidCount) {
          return b.totalBidCount - a.totalBidCount
        }
        return String(a.sponsorId).localeCompare(String(b.sponsorId))
      })

    return {
      auction: toManagerAuction(auction),
      competitionSummary,
      competitionSummarySource,
      competitionSummaryFetchedAt,
      competitionWcaCompetitionId: competition.wcaCompetitionId,
      inviteSponsorIds,
      intentCount: intents.length,
      eventCount: events.length,
      sponsorOutcomes,
    }
  },
})
