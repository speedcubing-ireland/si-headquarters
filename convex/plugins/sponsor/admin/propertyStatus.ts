import { v, type Infer } from "convex/values"
import { query, mutation } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireSponsorshipManager } from "@/convex/plugins/sponsor/permissions"
import {
  competitionSponsorPropertyStatus,
  sponsorshipAuctionFramework,
} from "@/convex/plugins/sponsor/lib/validators"
import type { SponsorshipAuctionFramework } from "@/convex/plugins/sponsor/lib/types"

type CompetitionSponsorPropertyStatus = Infer<
  typeof competitionSponsorPropertyStatus
>

async function deriveStatus(
  ctx: QueryCtx,
  competitionId: Id<"competitions">,
): Promise<CompetitionSponsorPropertyStatus> {
  const auctions = await ctx.db
    .query("sponsorshipAuctions")
    .withIndex("by_competition", (q) => q.eq("competitionId", competitionId))
    .collect()

  const openAuction = auctions.find(
    (auction) => auction.state === "active" || auction.state === "scheduled",
  )
  if (openAuction !== undefined) {
    return "bidding"
  }

  const closedWithWinner = auctions.find(
    (auction) =>
      auction.state === "closed" && auction.winnerSponsorId !== undefined,
  )
  if (closedWithWinner !== undefined) {
    return "sponsor"
  }

  if (auctions.length > 0) {
    return "none"
  }

  return "not_offered"
}

export const getForCompetition = query({
  args: { competitionId: v.id("competitions") },
  returns: v.object({
    status: competitionSponsorPropertyStatus,
    manualSponsorId: v.optional(v.id("sponsors")),
    winnerSponsorId: v.optional(v.id("sponsors")),
    settlementAmountCents: v.optional(v.number()),
    framework: v.optional(sponsorshipAuctionFramework),
  }),
  handler: async (ctx, args) => {
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new Error("Competition not found")
    }

    if (competition.manualSponsorPropertyStatus !== undefined) {
      return {
        status: competition.manualSponsorPropertyStatus,
        manualSponsorId: competition.manualSponsorId,
        winnerSponsorId: competition.manualSponsorId,
        settlementAmountCents: undefined,
        framework: undefined,
      }
    }

    const status = await deriveStatus(ctx, args.competitionId)
    const closedAuctions = await ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_competition_and_state", (q) =>
        q.eq("competitionId", args.competitionId).eq("state", "closed"),
      )
      .collect()
    const closedAuction = closedAuctions.find(
      (auction) => auction.winnerSponsorId !== undefined,
    )

    let framework: SponsorshipAuctionFramework | undefined
    if (closedAuction !== undefined) {
      framework = closedAuction.framework
    }

    return {
      status,
      manualSponsorId: competition.manualSponsorId,
      winnerSponsorId: closedAuction?.winnerSponsorId,
      settlementAmountCents: closedAuction?.settlementAmountCents,
      framework,
    }
  },
})

export const setManualOverride = mutation({
  args: {
    competitionId: v.id("competitions"),
    status: v.optional(v.union(competitionSponsorPropertyStatus, v.null())),
    manualSponsorId: v.optional(v.union(v.id("sponsors"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSponsorshipManager(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new Error("Competition not found")
    }

    const patch: Partial<Doc<"competitions">> = {}
    if (args.status !== undefined) {
      patch.manualSponsorPropertyStatus = args.status ?? undefined
    }
    if (args.manualSponsorId !== undefined) {
      patch.manualSponsorId = args.manualSponsorId ?? undefined
    }

    await ctx.db.patch("competitions", args.competitionId, patch)
    return null
  },
})
