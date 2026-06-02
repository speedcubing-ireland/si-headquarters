import { ConvexError, v } from "convex/values"
import { internalMutation, mutation } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"
import { resolveAuctionOutcome } from "../../lib/auctionState"
import { resolveAuctionStartTargetState } from "../../lib/lifecycle"
import {
  requireNoOpenAuctionForCompetition,
  type SponsorshipReadinessSnapshot,
} from "./shared"
import {
  cacheCompetitionFallbackSnapshot,
  scheduleCompetitionSnapshotRefresh,
} from "./competitionSnapshot"
import {
  sendAuctionActiveReminderEmail,
  sendAuctionClosureEmails,
  sendAuctionScheduledEmails,
  sendAuctionStartedEmails,
} from "./emails"
import {
  markReminderSent,
  markReminderSkipped,
  scheduleAuctionActiveRemindersOnActivation,
} from "./reminders"

function buildReadinessSnapshot(
  competition: Doc<"competitions">
): SponsorshipReadinessSnapshot {
  const warnings: string[] = []
  if (competition.people.compLead === null) {
    warnings.push("Competition lead is not set.")
  }
  if (competition.people.leadDelegate === null) {
    warnings.push("Lead delegate is not set.")
  }
  if (
    competition.compDates.from === null ||
    competition.compDates.from.length === 0
  ) {
    warnings.push("Competition start date is not set.")
  }
  return {
    checkedAt: Date.now(),
    warnings,
  }
}

export async function closeAuctionInternal(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  if (auction.state === "closed") return
  const intents = await ctx.db
    .query("sponsorshipBidIntents")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
    .collect()
  const validIntents = intents.filter((intent) => intent.isValid)
  const { settlementAmountCents, winnerSponsorId, winningBidId } =
    resolveAuctionOutcome({
      auction,
      validIntents,
    })

  await ctx.db.patch("sponsorshipAuctions", auction._id, {
    state: "closed",
    winnerSponsorId,
    winningBidId,
    settlementAmountCents,
    updatedAt: Date.now(),
  })

  const closedAuction = await ctx.db.get("sponsorshipAuctions", auction._id)
  if (closedAuction) {
    await sendAuctionClosureEmails(ctx, closedAuction)
  }
}

async function cancelScheduledIfPending(
  ctx: MutationCtx,
  id: Id<"_scheduled_functions"> | undefined
): Promise<void> {
  if (!id) return
  try {
    await ctx.scheduler.cancel(id)
  } catch {
    /* already completed or invalid */
  }
}

/** Schedule (or replace) activation at `auction.startsAt`. */
export async function scheduleAuctionActivation(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  await cancelScheduledIfPending(ctx, auction.activationScheduledFunctionId)
  const scheduledFunctionId = await ctx.scheduler.runAt(
    Math.max(auction.startsAt, Date.now()),
    internal.plugins.sponsor.admin.auctions.lifecycle._activateAuction,
    { auctionId: auction._id }
  )
  await ctx.db.patch("sponsorshipAuctions", auction._id, {
    activationScheduledFunctionId: scheduledFunctionId,
    updatedAt: Date.now(),
  })
}

/** Schedule (or replace) automatic close at `auction.endsAt`. */
export async function scheduleAuctionClosure(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  await cancelScheduledIfPending(ctx, auction.closureScheduledFunctionId)
  const scheduledFunctionId = await ctx.scheduler.runAt(
    Math.max(auction.endsAt, Date.now()),
    internal.plugins.sponsor.admin.auctions.lifecycle._closeAuction,
    { auctionId: auction._id }
  )
  await ctx.db.patch("sponsorshipAuctions", auction._id, {
    closureScheduledFunctionId: scheduledFunctionId,
    updatedAt: Date.now(),
  })
}

export const _activateAuction = internalMutation({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    if (auction.state !== "scheduled") return null
    const now = Date.now()
    if (auction.startsAt > now) return null

    await ctx.db.patch("sponsorshipAuctions", auction._id, {
      state: "active",
      updatedAt: now,
    })
    const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id)
    if (!refreshed) return null

    await sendAuctionStartedEmails(ctx, refreshed)
    await scheduleAuctionActiveRemindersOnActivation(ctx, refreshed)
    await scheduleAuctionClosure(ctx, refreshed)
    return null
  },
})

export const _closeAuction = internalMutation({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    if (auction.state !== "active") return null
    const now = Date.now()
    if (auction.endsAt > now) return null

    await closeAuctionInternal(ctx, auction)
    return null
  },
})

export const _fireReminder = internalMutation({
  args: { reminderId: v.id("sponsorshipAuctionReminders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(
      "sponsorshipAuctionReminders",
      args.reminderId
    )
    if (!reminder || reminder.sent) return null
    const now = Date.now()
    if (reminder.scheduledFor > now) return null

    const [reminderAuction, sponsor] = await Promise.all([
      ctx.db.get("sponsorshipAuctions", reminder.auctionId),
      ctx.db.get("sponsors", reminder.sponsorId),
    ])
    if (reminderAuction?.state !== "active" || sponsor?.active !== true) {
      await markReminderSkipped(ctx, reminder._id)
      return null
    }
    if (now >= reminderAuction.endsAt) {
      await markReminderSkipped(ctx, reminder._id)
      return null
    }
    await sendAuctionActiveReminderEmail(ctx, reminderAuction, sponsor)
    await markReminderSent(ctx, reminder._id)
    return null
  },
})

export const start = mutation({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    if (auction.state === "closed") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Closed auctions cannot be started.",
      })
    }
    const now = Date.now()
    const targetState = resolveAuctionStartTargetState({
      state: auction.state,
      startsAt: auction.startsAt,
      now,
    })
    if (targetState === "noop") {
      return null
    }

    const competition = await ctx.db.get("competitions", auction.competitionId)
    if (competition === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
    const wcaCompetitionId = competition.wcaCompetitionId
    if (wcaCompetitionId === undefined || wcaCompetitionId.length === 0) {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message:
          "Competition must be linked to a WCA competition before starting sponsorship.",
      })
    }
    await cacheCompetitionFallbackSnapshot(ctx, { auction, competition })
    if (auction.competitionSnapshot?.source !== "wca") {
      throw new ConvexError({
        code: "PRECONDITION_FAILED",
        message:
          "Competition details are not synced from WCA yet. Refresh competition data before opening.",
      })
    }
    await requireNoOpenAuctionForCompetition(
      ctx,
      auction.competitionId,
      auction._id
    )
    const readinessSnapshot = buildReadinessSnapshot(competition)

    await ctx.db.patch("sponsorshipAuctions", auction._id, {
      state: targetState,
      updatedById: actorId,
      updatedAt: now,
      readinessSnapshotJson: JSON.stringify(readinessSnapshot),
    })

    if (targetState === "scheduled") {
      const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id)
      if (refreshed) {
        await sendAuctionScheduledEmails(ctx, refreshed)
        await scheduleAuctionActivation(ctx, refreshed)
      }
    }
    if (targetState === "active") {
      const refreshed = await ctx.db.get("sponsorshipAuctions", auction._id)
      if (refreshed) {
        await sendAuctionStartedEmails(ctx, refreshed)
        await scheduleAuctionActiveRemindersOnActivation(ctx, refreshed)
        await scheduleAuctionClosure(ctx, refreshed)
      }
    }
    await scheduleCompetitionSnapshotRefresh(ctx, auction._id)
    return null
  },
})

export const close = mutation({
  args: { auctionId: v.id("sponsorshipAuctions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSponsorPortalAdmin(ctx)
    const auction = await ctx.db.get("sponsorshipAuctions", args.auctionId)
    if (!auction) return null
    const competition = await ctx.db.get("competitions", auction.competitionId)
    if (competition) {
      await cacheCompetitionFallbackSnapshot(ctx, { auction, competition })
    }
    await cancelScheduledIfPending(ctx, auction.activationScheduledFunctionId)
    await cancelScheduledIfPending(ctx, auction.closureScheduledFunctionId)
    await closeAuctionInternal(ctx, auction)
    await scheduleCompetitionSnapshotRefresh(ctx, auction._id)
    return null
  },
})
