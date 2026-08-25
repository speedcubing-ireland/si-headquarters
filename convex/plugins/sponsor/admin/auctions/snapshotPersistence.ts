import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { internalMutation, type ActionCtx } from "@/convex/_generated/server"
import { resolveAuctionSubject } from "@/convex/plugins/sponsor/lib/auctionSubject"
import {
  competitionSnapshot,
  type SponsorshipCompetitionSnapshot,
} from "@/convex/plugins/sponsor/lib/competitionSnapshot"
import { v } from "convex/values"

export type SnapshotRefreshIdentity =
  | {
      subjectKind: "hq_competition"
      competitionId: Id<"competitions">
      wcaCompetitionId?: string
    }
  | { subjectKind: "wca_competition"; wcaCompetitionId: string }
  | { subjectKind: "custom" }

const snapshotWriteExpectation = v.union(
  v.object({
    kind: v.literal("hq_competition"),
    competitionId: v.id("competitions"),
    wcaCompetitionId: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("wca_competition"),
    wcaCompetitionId: v.string(),
  }),
  v.object({ kind: v.literal("custom") })
)

function snapshotExpectation(identity: SnapshotRefreshIdentity) {
  if (identity.subjectKind === "hq_competition") {
    return {
      kind: "hq_competition" as const,
      competitionId: identity.competitionId,
      ...(identity.wcaCompetitionId === undefined
        ? {}
        : { wcaCompetitionId: identity.wcaCompetitionId }),
    }
  }
  if (identity.subjectKind === "wca_competition") {
    return {
      kind: "wca_competition" as const,
      wcaCompetitionId: identity.wcaCompetitionId,
    }
  }
  return { kind: "custom" as const }
}

export const setSnapshotIfCurrentInternal = internalMutation({
  args: {
    auctionId: v.id("sponsorshipAuctions"),
    expectation: snapshotWriteExpectation,
    snapshot: competitionSnapshot,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (auction === null) return false
    const subject = resolveAuctionSubject(auction)

    if (args.expectation.kind === "hq_competition") {
      if (
        subject.kind !== "hq_competition" ||
        subject.competitionId !== args.expectation.competitionId
      ) {
        return false
      }
      const competition = await ctx.db.get(
        "competitions",
        subject.competitionId
      )
      if (
        competition === null ||
        competition.wcaCompetitionId !== args.expectation.wcaCompetitionId
      ) {
        return false
      }
    } else if (args.expectation.kind === "wca_competition") {
      if (
        subject.kind !== "wca_competition" ||
        subject.wcaCompetitionId !== args.expectation.wcaCompetitionId
      ) {
        return false
      }
    } else if (subject.kind !== "custom") {
      return false
    }

    await ctx.db.patch("sponsorshipAuctions", args.auctionId, {
      competitionSnapshot: args.snapshot,
    })
    return true
  },
})

export async function storeSnapshotIfCurrent(
  ctx: ActionCtx,
  identity: SnapshotRefreshIdentity & { auctionId: Id<"sponsorshipAuctions"> },
  snapshot: SponsorshipCompetitionSnapshot
): Promise<boolean> {
  const stored: boolean = await ctx.runMutation(
    internal.plugins.sponsor.admin.auctions.snapshotPersistence
      .setSnapshotIfCurrentInternal,
    {
      auctionId: identity.auctionId,
      expectation: snapshotExpectation(identity),
      snapshot,
    }
  )
  return stored
}
