import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"
import { api, internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "@/convex/_generated/server"
import {
  buildCompetitionRecordSummary,
  buildCompetitionSnapshot,
  buildWcaCompetitionSummary,
  competitionSnapshot,
  sponsorshipCompetitionSummary,
  sponsorshipCompetitionSummarySource,
  type SponsorshipCompetitionSummary,
  type SponsorshipCompetitionSummarySource,
  type SponsorshipCompetitionSnapshot,
} from "@/convex/plugins/sponsor/lib/competitionSnapshot"
import {
  auctionSubjectKind,
  auctionSubjectName,
  resolveAuctionSubject,
} from "@/convex/plugins/sponsor/lib/auctionSubject"
import { competitionStartEnd } from "@/convex/competitions/dates"

const competitionSnapshotRefreshStatus = v.union(
  v.literal("ready"),
  v.literal("missing_wca_link"),
  v.literal("fetch_failed"),
  v.literal("not_found")
)

const competitionSnapshotRefreshResult = v.object({
  status: competitionSnapshotRefreshStatus,
  message: v.string(),
  summary: v.optional(sponsorshipCompetitionSummary),
  summarySource: v.optional(sponsorshipCompetitionSummarySource),
  fetchedAt: v.optional(v.number()),
})

const auctionSnapshotContext = v.object({
  auctionId: v.id("sponsorshipAuctions"),
  subjectKind: auctionSubjectKind,
  // Effective WCA id to fetch (the competition's link for hq subjects, or the
  // auction's id for wca subjects). Undefined for custom or unlinked hq.
  wcaCompetitionId: v.optional(v.string()),
  fallbackName: v.string(),
  fallbackStartDate: v.string(),
  fallbackEndDate: v.string(),
  competitionSnapshot: v.optional(competitionSnapshot),
})

function isConvexErrorWithCode(
  error: Error
): error is ConvexError<{ code: string; message: string }> {
  return error instanceof ConvexError
}

function convexErrorCode(error: Error): string | null {
  return isConvexErrorWithCode(error) ? error.data.code : null
}

export function isExpectedSponsorAccessError(error: Error): boolean {
  const code = convexErrorCode(error)
  return code === "UNAUTHENTICATED" || code === "FORBIDDEN"
}

function buildFallbackSnapshotFromContext(context: {
  fallbackName: string
  fallbackStartDate: string
  fallbackEndDate: string
}): SponsorshipCompetitionSnapshot {
  return buildCompetitionSnapshot({
    summary: {
      name: context.fallbackName,
      address: "",
      startDate: context.fallbackStartDate,
      endDate: context.fallbackEndDate,
      eventIds: [],
    },
    source: "competition_record",
  })
}

export function buildFallbackSnapshotForCompetition(
  competition: Pick<Doc<"competitions">, "name" | "compDates">
): SponsorshipCompetitionSnapshot {
  return buildCompetitionSnapshot({
    summary: buildCompetitionRecordSummary(competition),
    source: "competition_record",
  })
}

export async function cacheCompetitionFallbackSnapshot(
  ctx: MutationCtx,
  input: {
    auction: Doc<"sponsorshipAuctions">
    competition: Doc<"competitions">
  }
): Promise<void> {
  if (input.auction.competitionSnapshot?.source === "wca") {
    return
  }
  await ctx.db.patch("sponsorshipAuctions", input.auction._id, {
    competitionSnapshot: buildFallbackSnapshotForCompetition(input.competition),
  })
}

export async function scheduleCompetitionSnapshotRefresh(
  ctx: MutationCtx,
  auctionId: Id<"sponsorshipAuctions">
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.plugins.sponsor.admin.auctions.competitionSnapshot
      .refreshCompetitionSnapshotInternal,
    { auctionId }
  )
}

export const getSnapshotContextInternal = internalQuery({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.union(auctionSnapshotContext, v.null()),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    const subject = resolveAuctionSubject(auction)

    const snapshotStart =
      auction.competitionSnapshot?.summary.startDate ??
      new Date(auction.startsAt).toISOString().slice(0, 10)
    const snapshotEnd =
      auction.competitionSnapshot?.summary.endDate ??
      new Date(auction.endsAt).toISOString().slice(0, 10)

    if (subject.kind === "hq_competition") {
      const competition = await ctx.db.get(
        "competitions",
        subject.competitionId
      )
      if (competition === null) {
        return null
      }
      const { compStart, compEnd } = competitionStartEnd(competition)
      return {
        auctionId: auction._id,
        subjectKind: subject.kind,
        wcaCompetitionId: competition.wcaCompetitionId,
        fallbackName: competition.name,
        fallbackStartDate: compStart,
        fallbackEndDate: compEnd,
        competitionSnapshot: auction.competitionSnapshot,
      }
    }

    if (subject.kind === "wca_competition") {
      return {
        auctionId: auction._id,
        subjectKind: subject.kind,
        wcaCompetitionId: subject.wcaCompetitionId,
        fallbackName: auctionSubjectName(auction),
        fallbackStartDate: snapshotStart,
        fallbackEndDate: snapshotEnd,
        competitionSnapshot: auction.competitionSnapshot,
      }
    }

    // custom
    return {
      auctionId: auction._id,
      subjectKind: subject.kind,
      wcaCompetitionId: undefined,
      fallbackName: auctionSubjectName(auction),
      fallbackStartDate: snapshotStart,
      fallbackEndDate: snapshotEnd,
      competitionSnapshot: auction.competitionSnapshot,
    }
  },
})

export const setSnapshotInternal = internalMutation({
  args: {
    auctionId: v.id("sponsorshipAuctions"),
    snapshot: competitionSnapshot,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("sponsorshipAuctions", args.auctionId, {
      competitionSnapshot: args.snapshot,
    })
    return null
  },
})

async function runCompetitionSnapshotRefresh(
  ctx: ActionCtx,
  auctionId: Id<"sponsorshipAuctions">
): Promise<{
  status: "ready" | "missing_wca_link" | "fetch_failed" | "not_found"
  message: string
  summary?: SponsorshipCompetitionSummary
  summarySource?: SponsorshipCompetitionSummarySource
  fetchedAt?: number
}> {
  const context = await ctx.runQuery(
    internal.plugins.sponsor.admin.auctions.competitionSnapshot
      .getSnapshotContextInternal,
    { auctionId }
  )
  if (!context) {
    return {
      status: "not_found",
      message: "Auction not found.",
    }
  }

  if (context.subjectKind === "custom") {
    const customSnapshot =
      context.competitionSnapshot?.source === "custom"
        ? context.competitionSnapshot
        : buildCompetitionSnapshot({
            summary: {
              name: context.fallbackName,
              address: "",
              startDate: context.fallbackStartDate,
              endDate: context.fallbackEndDate,
              eventIds: [],
            },
            source: "custom",
          })
    if (context.competitionSnapshot?.source !== "custom") {
      await ctx.runMutation(
        internal.plugins.sponsor.admin.auctions.competitionSnapshot
          .setSnapshotInternal,
        {
          auctionId: context.auctionId,
          snapshot: customSnapshot,
        }
      )
    }
    return {
      status: "ready",
      message: "Custom offering details are up to date.",
      summary: customSnapshot.summary,
      summarySource: customSnapshot.source,
      fetchedAt: customSnapshot.fetchedAt,
    }
  }

  if (context.wcaCompetitionId === undefined) {
    const fallbackSnapshot =
      context.competitionSnapshot ?? buildFallbackSnapshotFromContext(context)
    if (context.competitionSnapshot === undefined) {
      await ctx.runMutation(
        internal.plugins.sponsor.admin.auctions.competitionSnapshot
          .setSnapshotInternal,
        {
          auctionId: context.auctionId,
          snapshot: fallbackSnapshot,
        }
      )
    }
    return {
      status: "missing_wca_link",
      message: "Competition is not linked to WCA.",
      summary: fallbackSnapshot.summary,
      summarySource: fallbackSnapshot.source,
      fetchedAt: fallbackSnapshot.fetchedAt,
    }
  }

  const details = await ctx.runAction(
    internal.plugins.sponsor.integrations.wca.fetchDetails
      .fetchCompetitionDetailsInternal,
    {
      wcaCompetitionId: context.wcaCompetitionId,
    }
  )
  if (details === null) {
    if (context.competitionSnapshot?.source === "wca") {
      return {
        status: "ready",
        message: "Using the latest cached WCA competition summary.",
        summary: context.competitionSnapshot.summary,
        summarySource: context.competitionSnapshot.source,
        fetchedAt: context.competitionSnapshot.fetchedAt,
      }
    }
    const fallbackSnapshot =
      context.competitionSnapshot ?? buildFallbackSnapshotFromContext(context)
    if (context.competitionSnapshot === undefined) {
      await ctx.runMutation(
        internal.plugins.sponsor.admin.auctions.competitionSnapshot
          .setSnapshotInternal,
        {
          auctionId: context.auctionId,
          snapshot: fallbackSnapshot,
        }
      )
    }
    return {
      status: "fetch_failed",
      message:
        "Could not fetch WCA competition details right now. Try again in a moment.",
      summary: fallbackSnapshot.summary,
      summarySource: fallbackSnapshot.source,
      fetchedAt: fallbackSnapshot.fetchedAt,
    }
  }

  const snapshot = buildCompetitionSnapshot({
    summary: buildWcaCompetitionSummary(details),
    source: "wca",
  })
  await ctx.runMutation(
    internal.plugins.sponsor.admin.auctions.competitionSnapshot
      .setSnapshotInternal,
    {
      auctionId: context.auctionId,
      snapshot,
    }
  )
  return {
    status: "ready",
    message: "Competition details synced from WCA.",
    summary: snapshot.summary,
    summarySource: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
  }
}

async function authorizeSnapshotRefresh(
  ctx: ActionCtx,
  args: {
    auctionId: Id<"sponsorshipAuctions">
    sessionToken?: string
  }
): Promise<void> {
  const userId = await getAuthUserId(ctx)
  if (userId !== null) {
    const isManager = await ctx.runQuery(
      internal.permissions.queries.canAccessSponsorPortalAdminForUserId,
      { userId }
    )
    if (isManager) return
  }

  if (args.sessionToken === undefined || args.sessionToken.length === 0) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Sponsorship manager access is required.",
    })
  }

  try {
    const auction = await ctx.runQuery(
      api.plugins.sponsor.portal.auctions.getAuction,
      {
        sessionToken: args.sessionToken,
        auctionId: args.auctionId,
      }
    )
    if (!auction) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "You do not have access to refresh this auction competition data.",
      })
    }
  } catch (error) {
    const err =
      error instanceof Error ? error : new Error("Snapshot refresh failed")
    if (!isExpectedSponsorAccessError(err)) {
      console.error("Unexpected error while authorizing snapshot refresh.", {
        auctionId: args.auctionId,
        error,
      })
      throw error
    }
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        "You do not have access to refresh this auction competition data.",
    })
  }
}

export const refreshCompetitionSnapshot = action({
  args: {
    auctionId: v.id("sponsorshipAuctions"),
    sessionToken: v.optional(v.string()),
  },
  returns: competitionSnapshotRefreshResult,
  handler: async (ctx, args) => {
    await authorizeSnapshotRefresh(ctx, args)
    return await runCompetitionSnapshotRefresh(ctx, args.auctionId)
  },
})

export const refreshCompetitionSnapshotInternal = internalAction({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: competitionSnapshotRefreshResult,
  handler: async (ctx, args) => {
    return await runCompetitionSnapshotRefresh(ctx, args.auctionId)
  },
})
