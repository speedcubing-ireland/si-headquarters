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

export async function requireNoOpenAuctionForCompetition(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Promise<void> {
  const auctions = await ctx.db
    .query("sponsorshipAuctions")
    .withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
    .collect()
  const openAuction = auctions.find(
    (auction) =>
      auction.state !== "closed" &&
      (ignoreAuctionId ? auction._id !== ignoreAuctionId : true)
  )
  if (openAuction) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message:
        "This competition already has a non-closed sponsorship auction. Close it before creating or starting another.",
    })
  }
}

export async function requireNoOpenAuctionForWcaCompetition(
  ctx: MutationCtx,
  wcaCompetitionId: string,
  ignoreAuctionId?: Id<"sponsorshipAuctions">
): Promise<void> {
  const auctions = await ctx.db
    .query("sponsorshipAuctions")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", wcaCompetitionId)
    )
    .collect()
  const openAuction = auctions.find(
    (auction) =>
      auction.state !== "closed" &&
      (ignoreAuctionId ? auction._id !== ignoreAuctionId : true)
  )
  if (openAuction) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message:
        "This WCA competition already has a non-closed sponsorship auction. Close it before creating another.",
    })
  }
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
