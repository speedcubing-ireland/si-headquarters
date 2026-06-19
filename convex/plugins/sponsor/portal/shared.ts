import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { requireSponsorByAuthSessionToken } from "../auth/accounts"
import type { SponsorContactPermissions } from "../lib/contacts"
import { minNextBidCents } from "../lib/bidding"
import { resolveSponsorBidStatus } from "../lib/sponsorBidStatus"
import { isSealedAuctionFramework } from "@/convex/plugins/sponsor/lib/types"
import {
  sponsorshipAuctionFramework,
  auctionState,
} from "@/convex/plugins/sponsor/lib/validators"
import {
  sponsorshipCompetitionSummary,
  sponsorshipCompetitionSummarySource,
} from "../lib/competitionSnapshot"
import { isSponsorVisibleAuctionState } from "../lib/visibility"

type SponsorCtx = QueryCtx | MutationCtx

export async function listInvitedVisibleAuctions(
  ctx: QueryCtx,
  sponsorId: Id<"sponsors">
): Promise<Doc<"sponsorshipAuctions">[]> {
  const invites = await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_sponsor", (q) => q.eq("sponsorId", sponsorId))
    .collect()
  const auctions = await Promise.all(
    invites.map((invite) => ctx.db.get("sponsorshipAuctions", invite.auctionId))
  )
  return auctions.filter((auction): auction is Doc<"sponsorshipAuctions"> => {
    if (!auction) return false
    return isSponsorVisibleAuctionState(auction.state)
  })
}

export const sponsorAuctionListItem = v.object({
  id: v.id("sponsorshipAuctions"),
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  framework: sponsorshipAuctionFramework,
  state: auctionState,
  currency: v.string(),
  competitionSummary: sponsorshipCompetitionSummary,
  competitionSummarySource: sponsorshipCompetitionSummarySource,
  startsAt: v.number(),
  endsAt: v.number(),
  startPriceCents: v.number(),
  currentPriceCents: v.optional(v.number()),
  minimumNextBidCents: v.number(),
  settlementAmountCents: v.optional(v.number()),
  sponsorBidStatus: v.optional(
    v.union(
      v.literal("winning"),
      v.literal("not_winning"),
      v.literal("winner"),
      v.literal("not_winner"),
      v.literal("bid_submitted"),
      v.literal("no_bid_submitted")
    )
  ),
})

export const sponsorSponsorshipLifecycle = v.union(
  v.literal("upcoming"),
  v.literal("ongoing"),
  v.literal("completed")
)

export const sponsorSponsorshipListItem = v.object({
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  competitionSummary: sponsorshipCompetitionSummary,
  competitionSummarySource: sponsorshipCompetitionSummarySource,
  lifecycle: sponsorSponsorshipLifecycle,
  managementAuctionId: v.optional(v.id("sponsorshipAuctions")),
  acquiredVia: v.union(
    v.literal("auction_win"),
    v.literal("manual_assignment")
  ),
})

export const sponsorBidEventForUI = v.object({
  id: v.id("sponsorshipBidEvents"),
  sponsorLabel: v.string(),
  isOwnBid: v.boolean(),
  amountCents: v.number(),
  isAuto: v.boolean(),
  createdAt: v.number(),
})

export function toSponsorBidEventForUI(input: {
  event: Doc<"sponsorshipBidEvents">
  sponsorLabel: string
  isOwnBid: boolean
}) {
  return {
    id: input.event._id,
    sponsorLabel: input.sponsorLabel,
    isOwnBid: input.isOwnBid,
    amountCents: input.event.amountCents,
    isAuto: input.isOwnBid ? input.event.isAuto : true,
    createdAt: input.event.createdAt,
  }
}

export type { SponsorContactPermissions }

export async function requireSponsorSession(
  ctx: SponsorCtx,
  sessionToken: string
): Promise<{
  sponsor: Doc<"sponsors">
  contact: Doc<"sponsorContacts"> | null
  permissions: SponsorContactPermissions
  session: Awaited<
    ReturnType<typeof requireSponsorByAuthSessionToken>
  >["session"]
  user: Awaited<ReturnType<typeof requireSponsorByAuthSessionToken>>["user"]
}> {
  return await requireSponsorByAuthSessionToken(ctx, sessionToken)
}

export async function requireSponsorCanBid(
  ctx: SponsorCtx,
  sessionToken: string
): Promise<{
  sponsor: Doc<"sponsors">
  contact: Doc<"sponsorContacts"> | null
  permissions: SponsorContactPermissions
}> {
  const session = await requireSponsorSession(ctx, sessionToken)
  if (!session.permissions.canBid) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your sponsor contact does not have permission to place bids.",
    })
  }
  return session
}

export async function requireAuctionInvite(
  ctx: SponsorCtx,
  auctionId: Id<"sponsorshipAuctions">,
  sponsorId: Id<"sponsors">
): Promise<void> {
  const invite = await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_auction_and_sponsor", (q) =>
      q.eq("auctionId", auctionId).eq("sponsorId", sponsorId)
    )
    .unique()
  if (!invite) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You are not invited to this auction.",
    })
  }
}

export function toSponsorAuctionListItem(input: {
  auction: Doc<"sponsorshipAuctions">
  competitionName: string
  competitionSummary: {
    name: string
    address: string
    startDate: string
    endDate: string
    competitorLimit?: number
    eventIds: string[]
  }
  competitionSummarySource: "competition_record" | "wca"
  hasAnyValidBid: boolean
  sponsorId?: Id<"sponsors">
  hasSponsorValidBid?: boolean
}) {
  const {
    auction,
    competitionName,
    competitionSummary,
    competitionSummarySource,
    hasAnyValidBid,
    sponsorId,
    hasSponsorValidBid,
  } = input
  const isSealed = isSealedAuctionFramework(auction.framework)
  const effectiveCurrentPriceCents = hasAnyValidBid
    ? (auction.currentPriceCents ?? auction.startPriceCents)
    : null
  const currentPriceCents = isSealed ? undefined : auction.currentPriceCents
  const minimumNextBidCents = isSealed
    ? auction.startPriceCents
    : minNextBidCents(effectiveCurrentPriceCents, auction.startPriceCents)
  const sponsorBidStatus =
    sponsorId === undefined
      ? undefined
      : resolveSponsorBidStatus({
          auction,
          sponsorId,
          hasSponsorValidBid: hasSponsorValidBid === true,
        })

  return {
    id: auction._id,
    competitionId: auction.competitionId,
    competitionName,
    framework: auction.framework,
    state: auction.state,
    currency: auction.currency,
    competitionSummary,
    competitionSummarySource,
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    startPriceCents: auction.startPriceCents,
    currentPriceCents,
    minimumNextBidCents,
    settlementAmountCents: auction.settlementAmountCents,
    ...(sponsorBidStatus ? { sponsorBidStatus } : {}),
  }
}
