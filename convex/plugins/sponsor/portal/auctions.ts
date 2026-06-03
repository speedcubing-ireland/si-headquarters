import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { compareBidIntentChronology } from "../lib/auctionState"
import { placeSponsorshipBid } from "../lib/bidPlacement"
import { buildCompetitionRecordSummary } from "@/convex/plugins/sponsor/lib/competitionSnapshot"
import { isProxyAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  competitionSponsorPropertyStatus,
} from "@/convex/plugins/sponsor/lib/validators"
import { sendEbayAuctionOutbidEmail } from "../admin/auctions/emails"
import { scheduleAuctionClosure } from "../admin/auctions/lifecycle"
import { syncActiveRemindersToAuctionEnd } from "../admin/auctions/reminders"
import {
  isBidHistoryVisibleToSponsor,
  isSponsorVisibleAuctionState,
} from "../lib/visibility"
import {
  listInvitedVisibleAuctions,
  requireAuctionInvite,
  requireSponsorSession,
  sponsorAuctionListItem,
  sponsorBidEventForUI,
  toSponsorBidEventForUI,
  toSponsorAuctionListItem,
} from "./shared"

async function maybeNotifyEbayOutbid(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  result: { outbidSponsorId?: Id<"sponsors">; extendedEndsAt?: number }
): Promise<void> {
  if (result.outbidSponsorId === undefined) return
  const auctionForEmail =
    result.extendedEndsAt !== undefined
      ? { ...auction, endsAt: result.extendedEndsAt }
      : auction
  await sendEbayAuctionOutbidEmail(ctx, auctionForEmail, result.outbidSponsorId)
}

async function rescheduleClosureWhenExtended(
  ctx: MutationCtx,
  auctionId: Id<"sponsorshipAuctions">,
  extendedEndsAt: number | undefined
): Promise<void> {
  if (extendedEndsAt === undefined) return
  const updatedAuction = await ctx.db.get("sponsorshipAuctions", auctionId)
  if (updatedAuction?.state !== "active") return
  await Promise.all([
    scheduleAuctionClosure(ctx, updatedAuction),
    syncActiveRemindersToAuctionEnd(ctx, updatedAuction),
  ])
}

export function sponsorBidEventLabel(input: {
  eventSponsorId: Id<"sponsors"> | undefined
  currentSponsorId: Id<"sponsors">
}): string {
  if (!input.eventSponsorId) return "System"
  if (input.eventSponsorId === input.currentSponsorId) return "You"
  return "Bidder"
}

export const listAuctions = query({
  args: { sessionToken: v.string() },
  returns: v.array(sponsorAuctionListItem),
  handler: async (ctx, args) => {
    const { sponsor } = await requireSponsorSession(ctx, args.sessionToken)
    const auctionDocs = await listInvitedVisibleAuctions(ctx, sponsor._id)
    const competitions = await Promise.all(
      auctionDocs.map((auction) =>
        ctx.db.get("competitions", auction.competitionId)
      )
    )
    const intentsByAuction = await Promise.all(
      auctionDocs.map((auction) =>
        ctx.db
          .query("sponsorshipBidIntents")
          .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
          .collect()
      )
    )
    const competitionNames = new Map<Id<"competitions">, string>()
    const competitionById = new Map<Id<"competitions">, Doc<"competitions">>()
    for (const competition of competitions) {
      if (!competition) continue
      competitionNames.set(competition._id, competition.name)
      competitionById.set(competition._id, competition)
    }
    const hasAnyValidBidByAuctionId = new Map<
      Id<"sponsorshipAuctions">,
      boolean
    >()
    const hasSponsorValidBidByAuctionId = new Map<
      Id<"sponsorshipAuctions">,
      boolean
    >()
    for (const [index, auction] of auctionDocs.entries()) {
      const intents = intentsByAuction[index] ?? []
      hasAnyValidBidByAuctionId.set(
        auction._id,
        intents.some((intent) => intent.isValid)
      )
      hasSponsorValidBidByAuctionId.set(
        auction._id,
        intents.some(
          (intent) => intent.isValid && intent.sponsorId === sponsor._id
        )
      )
    }

    return auctionDocs
      .sort((a, b) => b.endsAt - a.endsAt)
      .map((auction) => {
        const competitionName =
          competitionNames.get(auction.competitionId) ?? "Competition"
        const competition = competitionById.get(auction.competitionId)
        const competitionSummary =
          auction.competitionSnapshot?.summary ??
          (competition !== undefined
            ? buildCompetitionRecordSummary({
                name: competition.name,
                compDates: competition.compDates,
              })
            : buildCompetitionRecordSummary({
                name: competitionName,
                compDates: {
                  from: new Date(auction.startsAt).toISOString().slice(0, 10),
                  to: new Date(auction.endsAt).toISOString().slice(0, 10),
                },
              }))
        const competitionSummarySource =
          auction.competitionSnapshot?.source ?? "competition_record"
        return toSponsorAuctionListItem({
          auction,
          competitionName,
          competitionSummary,
          competitionSummarySource,
          hasAnyValidBid: hasAnyValidBidByAuctionId.get(auction._id) ?? false,
          sponsorId: sponsor._id,
          hasSponsorValidBid:
            hasSponsorValidBidByAuctionId.get(auction._id) ?? false,
        })
      })
  },
})

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
    v.null()
  ),
  handler: async (ctx, args) => {
    const { sponsor } = await requireSponsorSession(ctx, args.sessionToken)
    await requireAuctionInvite(ctx, args.auctionId, sponsor._id)

    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction || !isSponsorVisibleAuctionState(auction.state)) {
      return null
    }
    const competition = await ctx.db.get("competitions", auction.competitionId)
    if (!competition) {
      return null
    }

    const bidHistoryVisible = isBidHistoryVisibleToSponsor(auction)
    const [events, auctionIntents] = await Promise.all([
      bidHistoryVisible
        ? ctx.db
            .query("sponsorshipBidEvents")
            .withIndex("by_auction_and_created_at", (q) =>
              q.eq("auctionId", auction._id)
            )
            .collect()
        : Promise.resolve([]),
      ctx.db
        .query("sponsorshipBidIntents")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .collect(),
    ])
    const sponsorIntents = auctionIntents.filter(
      (intent) => intent.sponsorId === sponsor._id
    )
    const hasAnyValidBid = auctionIntents.some((intent) => intent.isValid)
    const latestValidSponsorIntent = sponsorIntents
      .filter((intent) => intent.isValid)
      .sort(compareBidIntentChronology)
      .at(-1)
    const myLastBidCents = latestValidSponsorIntent?.amountCents
    const myMaxBidCents = latestValidSponsorIntent?.maxAmountCents
    const hasSponsorValidBid = sponsorIntents.some((intent) => intent.isValid)
    const derivedSponsorPropertyStatus:
      | "bidding"
      | "none"
      | "not_offered"
      | "sponsor" =
      auction.state === "active" || auction.state === "scheduled"
        ? "bidding"
        : auction.winnerSponsorId
          ? "sponsor"
          : "none"
    const sponsorPropertyStatus = competition.manualSponsorId
      ? "sponsor"
      : (competition.manualSponsorPropertyStatus ??
        derivedSponsorPropertyStatus)
    const competitionSummary =
      auction.competitionSnapshot?.summary ??
      buildCompetitionRecordSummary({
        name: competition.name,
        compDates: competition.compDates,
      })
    const competitionSummarySource =
      auction.competitionSnapshot?.source ?? "competition_record"

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
        })
      ),
      bidHistoryVisible,
      sponsorPropertyStatus,
      myLastBidCents,
      myMaxBidCents,
    }
  },
})

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
  handler: async (ctx, args) => placeBidHandler(ctx, args),
})

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
  handler: async (ctx, args) => setMaxBidHandler(ctx, args),
})

interface PlaceBidArgs {
  sessionToken: string
  auctionId: Id<"sponsorshipAuctions">
  amountCents: number
}

interface SetMaxBidArgs {
  sessionToken: string
  auctionId: Id<"sponsorshipAuctions">
  maxAmountCents: number
}

interface SponsorBidMutationResult {
  currentPriceCents: number
  extendedEndsAt?: number
}

export async function placeBidHandler(
  ctx: MutationCtx,
  args: PlaceBidArgs
): Promise<SponsorBidMutationResult> {
  const { sponsor } = await requireSponsorSession(ctx, args.sessionToken)
  await requireAuctionInvite(ctx, args.auctionId, sponsor._id)

  const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
  if (!auction) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Auction not found.",
    })
  }
  const result = await placeSponsorshipBid(ctx, {
    auction,
    sponsorId: sponsor._id,
    amountCents: args.amountCents,
  })
  await rescheduleClosureWhenExtended(ctx, auction._id, result.extendedEndsAt)
  await maybeNotifyEbayOutbid(ctx, auction, result)
  return {
    currentPriceCents: result.currentPriceCents,
    extendedEndsAt: result.extendedEndsAt,
  }
}

export async function setMaxBidHandler(
  ctx: MutationCtx,
  args: SetMaxBidArgs
): Promise<SponsorBidMutationResult> {
  const { sponsor } = await requireSponsorSession(ctx, args.sessionToken)
  await requireAuctionInvite(ctx, args.auctionId, sponsor._id)

  const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
  if (!auction) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Auction not found.",
    })
  }
  if (!isProxyAuctionFramework(auction.framework)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Max bids are only available for Proxy Bidding auctions.",
    })
  }
  const result = await placeSponsorshipBid(ctx, {
    auction,
    sponsorId: sponsor._id,
    maxAmountCents: args.maxAmountCents,
  })
  await rescheduleClosureWhenExtended(ctx, auction._id, result.extendedEndsAt)
  await maybeNotifyEbayOutbid(ctx, auction, result)
  return {
    currentPriceCents: result.currentPriceCents,
    extendedEndsAt: result.extendedEndsAt,
  }
}
