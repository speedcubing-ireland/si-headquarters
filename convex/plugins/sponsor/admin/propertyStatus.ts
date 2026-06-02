import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import {
  findWinningClosedAuction,
  isCompetitionSponsorManualOverride,
  resolveCompetitionSponsorPropertyStatus,
} from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import { competitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/validators"

async function sponsorName(
  ctx: QueryCtx,
  sponsorId: Id<"sponsors">
): Promise<string | undefined> {
  const sponsor = await ctx.db.get("sponsors", sponsorId)
  return sponsor?.name
}

export const getForCompetition = query({
  args: { competitionId: v.id("competitions") },
  returns: v.object({
    status: competitionSponsorPropertyStatus,
    isManualOverride: v.boolean(),
    winnerSponsorId: v.optional(v.id("sponsors")),
    winnerSponsorName: v.optional(v.string()),
    settlementAmountCents: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }

    const isManualOverride = isCompetitionSponsorManualOverride(competition)
    const auctions = await ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", args.competitionId)
      )
      .collect()

    const status = resolveCompetitionSponsorPropertyStatus({
      competition,
      auctions,
    })

    const winnerSponsorId = isManualOverride
      ? competition.manualSponsorId
      : findWinningClosedAuction(auctions)?.winnerSponsorId

    const winningAuction = isManualOverride
      ? undefined
      : findWinningClosedAuction(auctions)

    return {
      status,
      isManualOverride,
      winnerSponsorId,
      winnerSponsorName:
        winnerSponsorId !== undefined
          ? await sponsorName(ctx, winnerSponsorId)
          : undefined,
      settlementAmountCents: winningAuction?.settlementAmountCents,
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
    await requireSponsorPortalAdmin(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
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
