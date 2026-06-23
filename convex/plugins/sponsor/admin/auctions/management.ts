import { collectAll } from "@/convex/utils"
import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { assertWcaIntegrationEnabled } from "@/convex/plugins/sponsor/lib/wcaIntegration"
import { compareBidIntentChronologyWithIdTieBreak } from "../../lib/auctionState"
import { competitionStartEnd } from "@/convex/competitions/dates"
import { sponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/validators"
import {
  auctionAssociatedCompetitionId,
  auctionSubjectInput,
  auctionSubjectName,
  resolveAuctionSubject,
  type AuctionSubjectInput,
  type AuctionSubjectKind,
} from "../../lib/auctionSubject"
import {
  buildCustomOfferingSnapshot,
  buildCustomOfferingSummary,
  buildWcaPlaceholderSnapshot,
  resolveCompetitionSummaryView,
  sponsorshipCompetitionSummary,
  sponsorshipCompetitionSummarySource,
  type SponsorshipCompetitionSnapshot,
  type SponsorshipCompetitionSummary,
  type SponsorshipCompetitionSummarySource,
} from "../../lib/competitionSnapshot"
import {
  auctionForManager,
  auctionTableRowForManager,
  competitionForSponsorshipManager,
  DEFAULT_SCHEDULE_WINDOW_MS,
  replaceAuctionInvites,
  requireNoOpenAuctionForCompetition,
  requireNoOpenAuctionForWcaCompetition,
  toManagerAuction,
} from "./shared"
import {
  buildFallbackSnapshotForCompetition,
  scheduleCompetitionSnapshotRefresh,
} from "./competitionSnapshot"
import { scheduleAuctionActivation } from "./lifecycle"
import { buildCompetitionSponsorStatusByCompetition } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import { getCompetitionSponsorOverridesByCompetitionId } from "@/convex/plugins/sponsor/lib/competitionSponsorOverrides"
import {
  defaultSponsorshipCurrency,
  formatSponsorshipAmount,
} from "@/convex/plugins/sponsor/lib/currency"

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
    subject: auctionSubjectInput,
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
    if (args.endsAt <= args.startsAt) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Auction end must be after start.",
      })
    }
    if (args.startPriceCents < 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Start price must be at least ${formatSponsorshipAmount(100)}.`,
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

    const subjectFields = await resolveCreateSubjectFields(ctx, {
      subject: args.subject,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    })

    const now = Date.now()
    const auctionId = await ctx.db.insert("sponsorshipAuctions", {
      ...subjectFields.fields,
      framework: args.framework ?? "first_sealed",
      state: "draft",
      currency: args.currency ?? defaultSponsorshipCurrency(),
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      antiSnipingWindowMs: antiSnipingWindowMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
      antiSnipingExtendMs: antiSnipingExtendMs ?? DEFAULT_SCHEDULE_WINDOW_MS,
      startPriceCents: args.startPriceCents,
      competitionSnapshot: subjectFields.snapshot,
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

interface ResolvedCreateSubject {
  fields: {
    subjectKind: AuctionSubjectKind
    competitionId?: Id<"competitions">
    wcaCompetitionId?: string
    customOffering?: {
      name: string
      descriptionMarkdown: string
      associatedCompetitionId?: Id<"competitions">
    }
  }
  snapshot: SponsorshipCompetitionSnapshot
}

async function resolveCreateSubjectFields(
  ctx: MutationCtx,
  input: {
    subject: AuctionSubjectInput
    startsAt: number
    endsAt: number
  }
): Promise<ResolvedCreateSubject> {
  const { subject, startsAt, endsAt } = input
  if (subject.kind === "hq_competition") {
    const competition = await ctx.db.get("competitions", subject.competitionId)
    if (!competition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
    await requireNoOpenAuctionForCompetition(ctx, subject.competitionId)
    return {
      fields: {
        subjectKind: "hq_competition",
        competitionId: subject.competitionId,
      },
      snapshot: buildFallbackSnapshotForCompetition(competition),
    }
  }
  if (subject.kind === "wca_competition") {
    assertWcaIntegrationEnabled()
    const wcaCompetitionId = subject.wcaCompetitionId.trim()
    if (wcaCompetitionId.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "A WCA competition must be selected.",
      })
    }
    await requireNoOpenAuctionForWcaCompetition(ctx, wcaCompetitionId)
    return {
      fields: {
        subjectKind: "wca_competition",
        wcaCompetitionId,
      },
      snapshot: buildWcaPlaceholderSnapshot({
        wcaCompetitionId,
        startsAt,
        endsAt,
      }),
    }
  }
  // custom
  const name = subject.name.trim()
  if (name.length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "A custom offering needs a name.",
    })
  }
  if (subject.associatedCompetitionId !== undefined) {
    const competition = await ctx.db.get(
      "competitions",
      subject.associatedCompetitionId
    )
    if (!competition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
  }
  return {
    fields: {
      subjectKind: "custom",
      customOffering: {
        name,
        descriptionMarkdown: subject.descriptionMarkdown,
        associatedCompetitionId: subject.associatedCompetitionId,
      },
    },
    snapshot: buildCustomOfferingSnapshot({ name, startsAt, endsAt }),
  }
}

/**
 * Resolve the auctioned-property summary, tolerating auctions that have no HQ
 * competition (WCA-direct or standalone custom offerings) by falling back to the
 * snapshot that is always seeded at creation time.
 */
function resolveAuctionSummaryView(
  auction: Doc<"sponsorshipAuctions">,
  competition: Doc<"competitions"> | null
): {
  summary: SponsorshipCompetitionSummary
  source: SponsorshipCompetitionSummarySource
  fetchedAt: number | undefined
} {
  if (competition) {
    return resolveCompetitionSummaryView(
      auction.competitionSnapshot,
      competition
    )
  }
  const snapshot = auction.competitionSnapshot
  return {
    summary:
      snapshot?.summary ??
      buildCustomOfferingSummary({
        name: auctionSubjectName(auction),
        startsAt: auction.startsAt,
        endsAt: auction.endsAt,
      }),
    source: snapshot?.source ?? "custom",
    fetchedAt: snapshot?.fetchedAt,
  }
}

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
    // Custom-offering edits (ignored for other subject kinds).
    offeringName: v.optional(v.string()),
    offeringDescriptionMarkdown: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    const subject = resolveAuctionSubject(auction)
    if (auction.state === "closed") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Closed auctions cannot be edited.",
      })
    }
    const isOfferingEdit =
      args.offeringName !== undefined ||
      args.offeringDescriptionMarkdown !== undefined
    if (
      auction.state === "active" &&
      (args.framework !== undefined ||
        args.startsAt !== undefined ||
        args.endsAt !== undefined ||
        args.startPriceCents !== undefined ||
        args.invitedSponsorIds !== undefined ||
        isOfferingEdit)
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Active auctions cannot be edited. Use close and relaunch if changes are required.",
      })
    }
    if (isOfferingEdit && subject.kind !== "custom") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Only custom-offering auctions have an editable name.",
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
        message: `Start price must be at least ${formatSponsorshipAmount(100)}.`,
      })
    }

    if (subject.kind === "custom") {
      const nextName = (args.offeringName ?? subject.name).trim()
      if (nextName.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "A custom offering needs a name.",
        })
      }
      const nextDescription =
        args.offeringDescriptionMarkdown ?? subject.descriptionMarkdown
      patch.customOffering = {
        name: nextName,
        descriptionMarkdown: nextDescription,
        associatedCompetitionId: subject.associatedCompetitionId,
      }
      patch.competitionSnapshot = buildCustomOfferingSnapshot({
        name: nextName,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
      })
    } else if (subject.kind === "hq_competition") {
      const competition = await ctx.db.get(
        "competitions",
        subject.competitionId
      )
      if (!competition) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Competition not found.",
        })
      }
      if (auction.competitionSnapshot?.source !== "wca") {
        patch.competitionSnapshot =
          buildFallbackSnapshotForCompetition(competition)
      }
    }

    await ctx.db.patch("sponsorshipAuctions", auction._id, patch)
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

    const canonicalCompetitionIds = [
      ...new Set(
        auctions
          .map((auction) => auction.competitionId)
          .filter((id): id is Id<"competitions"> => id !== undefined)
      ),
    ]
    const displayCompetitionIds = [
      ...new Set(
        auctions
          .map((auction) => auctionAssociatedCompetitionId(auction))
          .filter((id): id is Id<"competitions"> => id !== undefined)
      ),
    ]
    const [competitions, overridesByCompetitionId] = await Promise.all([
      Promise.all(
        displayCompetitionIds.map((competitionId) =>
          ctx.db.get("competitions", competitionId)
        )
      ),
      getCompetitionSponsorOverridesByCompetitionId(
        ctx,
        canonicalCompetitionIds
      ),
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
      competitionIds: canonicalCompetitionIds,
      auctions,
      overridesByCompetitionId,
    })

    return auctions
      .map((auction) => {
        const associatedCompetitionId = auctionAssociatedCompetitionId(auction)
        const competition =
          associatedCompetitionId !== undefined
            ? competitionById.get(associatedCompetitionId)
            : undefined
        const canonicalCompetition =
          auction.competitionId !== undefined
            ? competitionById.get(auction.competitionId)
            : undefined
        const subject = resolveAuctionSubject(auction)
        const wcaCompetitionId =
          subject.kind === "wca_competition"
            ? subject.wcaCompetitionId
            : competition?.wcaCompetitionId
        return {
          id: auction._id,
          subjectKind: subject.kind,
          subjectName: auctionSubjectName(auction),
          competitionId: canonicalCompetition?._id,
          associatedCompetitionId: competition?._id,
          wcaCompetitionId,
          competitionName: competition?.name,
          competitionCompStart: competition
            ? competitionStartEnd(competition).compStart
            : undefined,
          competitionPhaseName: competition
            ? competition.phaseId
              ? (phaseNameById.get(competition.phaseId) ?? "Unknown phase")
              : "No phase"
            : undefined,
          competitionSponsorStatus: canonicalCompetition
            ? (statusByCompetition.get(canonicalCompetition._id) ??
              "not_offered")
            : undefined,
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
      auction.competitionId !== undefined
        ? ctx.db.get("competitions", auction.competitionId)
        : Promise.resolve(null),
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
    const {
      summary: competitionSummary,
      source: competitionSummarySource,
      fetchedAt: competitionSummaryFetchedAt,
    } = resolveAuctionSummaryView(auction, competition)
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
      competitionWcaCompetitionId:
        auction.subjectKind === "wca_competition"
          ? auction.wcaCompetitionId
          : (competition?.wcaCompetitionId ?? undefined),
      inviteSponsorIds,
      intentCount: intents.length,
      eventCount: events.length,
      sponsorOutcomes,
    }
  },
})
