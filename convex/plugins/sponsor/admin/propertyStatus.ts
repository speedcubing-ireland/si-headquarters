import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import {
  findWinningClosedAuction,
  isCompetitionSponsorManualOverride,
  resolveCompetitionSponsorPropertyStatus,
} from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import {
  getCompetitionSponsorOverride,
  upsertCompetitionSponsorOverride,
} from "@/convex/plugins/sponsor/lib/competitionSponsorOverrides"
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
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }

    const override = await getCompetitionSponsorOverride(
      ctx,
      args.competitionId
    )
    const isManualOverride = isCompetitionSponsorManualOverride(override)
    const auctions = await ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", args.competitionId)
      )
      .collect()

    const status = resolveCompetitionSponsorPropertyStatus({
      override,
      auctions,
    })

    const winnerSponsorId = isManualOverride
      ? override?.manualSponsorId
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
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const competition = await ctx.db.get("competitions", args.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found",
      })
    }

    const existing = await getCompetitionSponsorOverride(
      ctx,
      args.competitionId
    )
    const manualSponsorPropertyStatus =
      args.status !== undefined
        ? (args.status ?? undefined)
        : existing?.manualSponsorPropertyStatus
    const manualSponsorId =
      args.manualSponsorId !== undefined
        ? (args.manualSponsorId ?? undefined)
        : existing?.manualSponsorId
    const sponsorChanged =
      args.manualSponsorId !== undefined &&
      existing?.manualSponsorId !== manualSponsorId
    const statusChanged =
      args.status !== undefined &&
      existing?.manualSponsorPropertyStatus !== manualSponsorPropertyStatus

    if (!sponsorChanged && !statusChanged) {
      return null
    }

    await upsertCompetitionSponsorOverride(ctx, {
      competitionId: args.competitionId,
      manualSponsorPropertyStatus,
      manualSponsorId,
      updatedById: actorId,
    })
    const sponsor =
      args.manualSponsorId !== undefined && args.manualSponsorId !== null
        ? await ctx.db.get("sponsors", args.manualSponsorId)
        : null
    await scheduleNotificationEvent(ctx, {
      kind: "sponsorSet",
      competitionId: args.competitionId,
      actorId,
      sponsorName: sponsor?.name ?? null,
    })
    return null
  },
})
