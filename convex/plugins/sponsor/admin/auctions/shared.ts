import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  competitionSponsorPropertyStatus,
  sponsorshipAuctionFramework,
  auctionState,
} from "@/convex/plugins/sponsor/lib/validators"
import { competitionSnapshot } from "../../lib/competitionSnapshot"
import {
  auctionAssociatedCompetitionId,
  auctionSubjectKind,
  auctionSubjectName,
  auctionSubjectView,
  resolveAuctionSubject,
} from "../../lib/auctionSubject"

export const DEFAULT_SCHEDULE_WINDOW_MS = 5 * 60 * 1000

export interface SponsorshipReadinessSnapshot {
  checkedAt: number
  warnings: string[]
}

export const auctionForManager = v.object({
  id: v.id("sponsorshipAuctions"),
  subject: auctionSubjectView,
  subjectName: v.string(),
  competitionId: v.optional(v.id("competitions")),
  associatedCompetitionId: v.optional(v.id("competitions")),
  framework: sponsorshipAuctionFramework,
  state: auctionState,
  currency: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  antiSnipingWindowMs: v.number(),
  antiSnipingExtendMs: v.number(),
  startPriceCents: v.number(),
  currentPriceCents: v.optional(v.number()),
  currentLeaderSponsorId: v.optional(v.id("sponsors")),
  winnerSponsorId: v.optional(v.id("sponsors")),
  settlementAmountCents: v.optional(v.number()),
  competitionSnapshot: v.optional(competitionSnapshot),
  updatedAt: v.number(),
})

export const competitionForSponsorshipManager = v.object({
  id: v.id("competitions"),
  name: v.string(),
  compStart: v.string(),
  compEnd: v.string(),
  wcaCompetitionId: v.optional(v.string()),
  currentPhaseName: v.string(),
  sponsorPropertyStatus: competitionSponsorPropertyStatus,
  manualSponsorPropertyStatus: v.optional(competitionSponsorPropertyStatus),
  manualSponsorId: v.optional(v.id("sponsors")),
})

export const auctionTableRowForManager = v.object({
  id: v.id("sponsorshipAuctions"),
  subjectKind: auctionSubjectKind,
  subjectName: v.string(),
  competitionId: v.optional(v.id("competitions")),
  associatedCompetitionId: v.optional(v.id("competitions")),
  wcaCompetitionId: v.optional(v.string()),
  competitionName: v.optional(v.string()),
  competitionCompStart: v.optional(v.string()),
  competitionPhaseName: v.optional(v.string()),
  competitionSponsorStatus: v.optional(competitionSponsorPropertyStatus),
  framework: sponsorshipAuctionFramework,
  state: auctionState,
  currency: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  startPriceCents: v.number(),
  currentPriceCents: v.optional(v.number()),
  currentLeaderSponsorId: v.optional(v.id("sponsors")),
  winnerSponsorId: v.optional(v.id("sponsors")),
  settlementAmountCents: v.optional(v.number()),
  updatedAt: v.number(),
})

function uniqueSponsorIds(sponsorIds: Id<"sponsors">[]): Id<"sponsors">[] {
  return [...new Set(sponsorIds)]
}

function findOpenAuction(
  auctions: Doc<"sponsorshipAuctions">[],
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Doc<"sponsorshipAuctions"> | undefined {
  return auctions.find(
    (auction) =>
      auction.state !== "closed" &&
      (ignoreAuctionId === undefined || auction._id !== ignoreAuctionId)
  )
}

interface AuctionScope {
  competitionIds: Id<"competitions">[]
  wcaCompetitionIds: string[]
}

async function resolveAuctionScopeFromCompetition(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<AuctionScope> {
  const competition = await ctx.db.get("competitions", competitionId)
  const wcaCompetitionId = competition?.wcaCompetitionId
  return {
    competitionIds: [competitionId],
    wcaCompetitionIds:
      wcaCompetitionId !== undefined && wcaCompetitionId.length > 0
        ? [wcaCompetitionId]
        : [],
  }
}

async function resolveAuctionScopeFromWcaCompetition(
  ctx: MutationCtx,
  wcaCompetitionId: string
): Promise<AuctionScope> {
  const linkedCompetitions = await ctx.db
    .query("competitions")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", wcaCompetitionId)
    )
    .collect()
  return {
    competitionIds: linkedCompetitions.map((competition) => competition._id),
    wcaCompetitionIds: [wcaCompetitionId],
  }
}

async function gatherAuctionsInScope(
  ctx: MutationCtx,
  scope: AuctionScope
): Promise<Doc<"sponsorshipAuctions">[]> {
  const allResults = await Promise.all([
    ...scope.competitionIds.map((id) =>
      ctx.db
        .query("sponsorshipAuctions")
        .withIndex("by_competition", (q) => q.eq("competitionId", id))
        .collect()
    ),
    ...scope.wcaCompetitionIds.map((id) =>
      ctx.db
        .query("sponsorshipAuctions")
        .withIndex("by_wcaCompetitionId", (q) => q.eq("wcaCompetitionId", id))
        .collect()
    ),
  ])
  const auctionsById = new Map<
    Id<"sponsorshipAuctions">,
    Doc<"sponsorshipAuctions">
  >()
  for (const auction of allResults.flat()) {
    auctionsById.set(auction._id, auction)
  }
  return [...auctionsById.values()]
}

const OPEN_AUCTION_EXISTS_MESSAGE =
  "An open sponsorship auction already exists for this competition. Close it before creating or starting another."

async function requireNoOpenAuctionInScope(
  ctx: MutationCtx,
  scope: AuctionScope,
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Promise<void> {
  const auctions = await gatherAuctionsInScope(ctx, scope)
  const openAuction = findOpenAuction(auctions, ignoreAuctionId)
  if (openAuction) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: OPEN_AUCTION_EXISTS_MESSAGE,
    })
  }
}

export async function requireNoOpenAuctionForCompetition(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Promise<void> {
  const scope = await resolveAuctionScopeFromCompetition(ctx, competitionId)
  await requireNoOpenAuctionInScope(ctx, scope, ignoreAuctionId)
}

export async function requireNoOpenAuctionForWcaCompetition(
  ctx: MutationCtx,
  wcaCompetitionId: string,
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Promise<void> {
  const scope = await resolveAuctionScopeFromWcaCompetition(
    ctx,
    wcaCompetitionId
  )
  await requireNoOpenAuctionInScope(ctx, scope, ignoreAuctionId)
}

export async function replaceAuctionInvites(
  ctx: MutationCtx,
  args: {
    auctionId: Id<"sponsorshipAuctions">
    sponsorIds: Id<"sponsors">[]
    actorId: Id<"users">
  }
): Promise<void> {
  const desired = uniqueSponsorIds(args.sponsorIds)
  const desiredSponsors = await Promise.all(
    desired.map((sponsorId) => ctx.db.get("sponsors", sponsorId))
  )
  const invalidInviteSponsor = desiredSponsors.find(
    (sponsor) => sponsor?.active !== true
  )
  if (invalidInviteSponsor) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "All invited sponsors must exist and be active.",
    })
  }

  const current = await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    .collect()
  const currentBySponsor = new Map(
    current.map((invite) => [invite.sponsorId, invite])
  )
  const desiredSet = new Set(desired)
  const now = Date.now()

  await Promise.all([
    ...desired
      .filter((sponsorId) => !currentBySponsor.has(sponsorId))
      .map((sponsorId) =>
        ctx.db.insert("sponsorshipAuctionInvites", {
          auctionId: args.auctionId,
          sponsorId,
          invitedById: args.actorId,
          invitedAt: now,
        })
      ),
    ...current
      .filter((invite) => !desiredSet.has(invite.sponsorId))
      .map((invite) => ctx.db.delete("sponsorshipAuctionInvites", invite._id)),
  ])
}

export function toManagerAuction(auction: Doc<"sponsorshipAuctions">) {
  return {
    id: auction._id,
    subject: resolveAuctionSubject(auction),
    subjectName: auctionSubjectName(auction),
    competitionId: auction.competitionId,
    associatedCompetitionId: auctionAssociatedCompetitionId(auction),
    framework: auction.framework,
    state: auction.state,
    currency: auction.currency,
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    antiSnipingWindowMs: auction.antiSnipingWindowMs,
    antiSnipingExtendMs: auction.antiSnipingExtendMs,
    startPriceCents: auction.startPriceCents,
    currentPriceCents: auction.currentPriceCents,
    currentLeaderSponsorId: auction.currentLeaderSponsorId,
    winnerSponsorId: auction.winnerSponsorId,
    settlementAmountCents: auction.settlementAmountCents,
    competitionSnapshot: auction.competitionSnapshot,
    updatedAt: auction.updatedAt,
  }
}
