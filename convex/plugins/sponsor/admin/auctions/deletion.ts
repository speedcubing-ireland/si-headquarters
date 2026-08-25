import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { CompetitionDeletionPlugin } from "@/convex/competitions/deletionPlugin"
import {
  reserveDeletionWork,
  type DeletionBudget,
} from "@/convex/deletion/budget"
import { cancelScheduledFunction } from "@/convex/deletion/scheduledFunctions"
import { runDeletionWork } from "@/convex/deletion/work"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { resolveAuctionSubject } from "@/convex/plugins/sponsor/lib/auctionSubject"
import { ConvexError } from "convex/values"

const MAX_COMPETITION_AUCTIONS = 100
const MAX_ROWS_PER_AUCTION_RELATION = 500
const AUCTION_READ_CONCURRENCY = 2

interface AuctionDeletionPlan {
  auction: Doc<"sponsorshipAuctions">
  dispatches: Doc<"sponsorshipEmailDispatches">[]
  events: Doc<"sponsorshipBidEvents">[]
  intents: Doc<"sponsorshipBidIntents">[]
  invites: Doc<"sponsorshipAuctionInvites">[]
  outbidNotices: Doc<"sponsorshipAuctionOutbidNotices">[]
  reminders: Doc<"sponsorshipAuctionReminders">[]
}

interface CompetitionAuctionCleanupPlan {
  deleteAuctions: AuctionDeletionPlan[]
  detachCustomAuctions: Doc<"sponsorshipAuctions">[]
  detachHistoricalHqAuctions: Doc<"sponsorshipAuctions">[]
  historicalCompetitionName: string
}

async function loadAuctionDeletionPlan(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<AuctionDeletionPlan> {
  const take = MAX_ROWS_PER_AUCTION_RELATION + 1
  const [invites, reminders, outbidNotices, dispatches, intents, events] =
    await Promise.all([
      ctx.db
        .query("sponsorshipAuctionInvites")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .take(take),
      ctx.db
        .query("sponsorshipAuctionReminders")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .take(take),
      ctx.db
        .query("sponsorshipAuctionOutbidNotices")
        .withIndex("by_auction_and_sponsor", (q) =>
          q.eq("auctionId", auction._id)
        )
        .take(take),
      ctx.db
        .query("sponsorshipEmailDispatches")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .take(take),
      ctx.db
        .query("sponsorshipBidIntents")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .take(take),
      ctx.db
        .query("sponsorshipBidEvents")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .take(take),
    ])
  if (
    [invites, reminders, outbidNotices, dispatches, intents, events].some(
      (rows) => rows.length > MAX_ROWS_PER_AUCTION_RELATION
    )
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Auction has more than ${String(MAX_ROWS_PER_AUCTION_RELATION)} records in one related collection.`,
    })
  }
  return {
    auction,
    dispatches,
    events,
    intents,
    invites,
    outbidNotices,
    reminders,
  }
}

function auctionDeletionWriteCount(plan: AuctionDeletionPlan): number {
  return (
    1 +
    plan.dispatches.length +
    plan.events.length +
    plan.intents.length +
    plan.invites.length +
    plan.outbidNotices.length +
    plan.reminders.length
  )
}

export async function prepareAuctionDeletion(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  budget: DeletionBudget
): Promise<AuctionDeletionPlan> {
  const plan = await loadAuctionDeletionPlan(ctx, auction)
  reserveDeletionWork(budget, {
    reason: "sponsorship auction records",
    writes: auctionDeletionWriteCount(plan),
  })
  return plan
}

export async function executeAuctionDeletion(
  ctx: MutationCtx,
  plan: AuctionDeletionPlan
): Promise<void> {
  await Promise.all([
    cancelScheduledFunction(ctx, plan.auction.activationScheduledFunctionId),
    cancelScheduledFunction(ctx, plan.auction.closureScheduledFunctionId),
  ])
  await runDeletionWork(plan.reminders, async (reminder) => {
    await cancelScheduledFunction(ctx, reminder.scheduledFunctionId)
  })
  await Promise.all([
    runDeletionWork(plan.invites, async (row) => {
      await ctx.db.delete("sponsorshipAuctionInvites", row._id)
    }),
    runDeletionWork(plan.reminders, async (row) => {
      await ctx.db.delete("sponsorshipAuctionReminders", row._id)
    }),
    runDeletionWork(plan.outbidNotices, async (row) => {
      await ctx.db.delete("sponsorshipAuctionOutbidNotices", row._id)
    }),
    runDeletionWork(plan.dispatches, async (row) => {
      await ctx.db.delete("sponsorshipEmailDispatches", row._id)
    }),
    runDeletionWork(plan.events, async (row) => {
      await ctx.db.delete("sponsorshipBidEvents", row._id)
    }),
    runDeletionWork(plan.intents, async (row) => {
      await ctx.db.delete("sponsorshipBidIntents", row._id)
    }),
  ])
  await ctx.db.delete("sponsorshipAuctions", plan.auction._id)
}

async function prepareCompetitionAuctionCleanup(
  ctx: MutationCtx,
  input: {
    budget: DeletionBudget
    competition: Doc<"competitions">
  }
): Promise<CompetitionAuctionCleanupPlan> {
  const [hqAuctions, customAuctions] = await Promise.all([
    ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", input.competition._id)
      )
      .take(MAX_COMPETITION_AUCTIONS + 1),
    ctx.db
      .query("sponsorshipAuctions")
      .withIndex("by_customOffering_associatedCompetitionId", (q) =>
        q.eq("customOffering.associatedCompetitionId", input.competition._id)
      )
      .take(MAX_COMPETITION_AUCTIONS + 1),
  ])
  const auctions = new Map<
    Id<"sponsorshipAuctions">,
    Doc<"sponsorshipAuctions">
  >([...hqAuctions, ...customAuctions].map((auction) => [auction._id, auction]))
  if (auctions.size > MAX_COMPETITION_AUCTIONS) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Competition has more than ${String(MAX_COMPETITION_AUCTIONS)} associated sponsorship auctions.`,
    })
  }
  if (auctions.size > 0) {
    await requireSponsorPortalAdmin(ctx)
  }

  const detachCustomAuctions: Doc<"sponsorshipAuctions">[] = []
  const detachHistoricalHqAuctions: Doc<"sponsorshipAuctions">[] = []
  const auctionsToDelete: Doc<"sponsorshipAuctions">[] = []
  for (const auction of auctions.values()) {
    const subject = resolveAuctionSubject(auction)
    if (subject.kind === "custom") {
      detachCustomAuctions.push(auction)
    } else if (auction.state === "active" || auction.state === "closed") {
      detachHistoricalHqAuctions.push(auction)
    } else {
      auctionsToDelete.push(auction)
    }
  }
  reserveDeletionWork(input.budget, {
    reason: "historical sponsorship auction detachment",
    writes: detachCustomAuctions.length + detachHistoricalHqAuctions.length,
  })

  const deleteAuctions: AuctionDeletionPlan[] = []
  for (
    let index = 0;
    index < auctionsToDelete.length;
    index += AUCTION_READ_CONCURRENCY
  ) {
    const batch = auctionsToDelete.slice(
      index,
      index + AUCTION_READ_CONCURRENCY
    )
    const plans = await Promise.all(
      batch.map(
        async (auction) =>
          await prepareAuctionDeletion(ctx, auction, input.budget)
      )
    )
    deleteAuctions.push(...plans)
  }

  return {
    deleteAuctions,
    detachCustomAuctions,
    detachHistoricalHqAuctions,
    historicalCompetitionName: input.competition.name,
  }
}

async function executeCompetitionAuctionCleanup(
  ctx: MutationCtx,
  plan: CompetitionAuctionCleanupPlan
): Promise<void> {
  for (const auctionPlan of plan.deleteAuctions) {
    await executeAuctionDeletion(ctx, auctionPlan)
  }
  await Promise.all([
    runDeletionWork(plan.detachCustomAuctions, async (auction) => {
      const customOffering = auction.customOffering
      if (customOffering === undefined) return
      await ctx.db.patch("sponsorshipAuctions", auction._id, {
        customOffering: {
          ...customOffering,
          associatedCompetitionId: undefined,
        },
      })
    }),
    runDeletionWork(plan.detachHistoricalHqAuctions, async (auction) => {
      await ctx.db.patch("sponsorshipAuctions", auction._id, {
        subjectKind: "custom",
        competitionId: undefined,
        wcaCompetitionId: undefined,
        customOffering: {
          name:
            auction.competitionSnapshot?.summary.name ??
            plan.historicalCompetitionName,
          descriptionMarkdown:
            "Historical sponsorship auction retained after its HQ competition was deleted.",
        },
      })
    }),
  ])
}

export const sponsorCompetitionDeletionPlugin = {
  id: "sponsor",
  prepareCompetitionDeletion: async (ctx, input) => {
    const plan = await prepareCompetitionAuctionCleanup(ctx, input)
    return {
      execute: async () => {
        await executeCompetitionAuctionCleanup(ctx, plan)
      },
    }
  },
} satisfies CompetitionDeletionPlugin
