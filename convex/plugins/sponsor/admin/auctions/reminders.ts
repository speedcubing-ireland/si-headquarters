import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import { isExpectedPendingSchedule } from "./scheduledFunctions"

/** Send the “bidding closes in 1 hour” email this long before `auction.endsAt`. */
export const AUCTION_ACTIVE_REMINDER_LEAD_MS = 60 * 60 * 1000

export function auctionActiveReminderScheduledFor(endsAt: number): number {
  return endsAt - AUCTION_ACTIVE_REMINDER_LEAD_MS
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

async function scheduleAuctionActiveReminder(
  ctx: MutationCtx,
  reminderId: Id<"sponsorshipAuctionReminders">,
  scheduledFor: number
): Promise<void> {
  const scheduledFunctionId = await ctx.scheduler.runAt(
    Math.max(scheduledFor, Date.now()),
    internal.plugins.sponsor.admin.auctions.lifecycle._fireReminder,
    { reminderId }
  )
  await ctx.db.patch("sponsorshipAuctionReminders", reminderId, {
    scheduledFor,
    scheduledFunctionId,
  })
}

async function createAuctionActiveReminder(
  ctx: MutationCtx,
  auctionId: Id<"sponsorshipAuctions">,
  sponsorId: Id<"sponsors">,
  scheduledFor: number
): Promise<void> {
  const sent = scheduledFor <= Date.now()
  const reminderId = await ctx.db.insert("sponsorshipAuctionReminders", {
    auctionId,
    sponsorId,
    scheduledFor,
    sent,
  })
  if (!sent) {
    await scheduleAuctionActiveReminder(ctx, reminderId, scheduledFor)
  }
}

async function rescheduleAuctionActiveReminder(
  ctx: MutationCtx,
  reminder: Doc<"sponsorshipAuctionReminders">,
  scheduledFor: number
): Promise<void> {
  await cancelScheduledIfPending(ctx, reminder.scheduledFunctionId)
  if (scheduledFor <= Date.now()) {
    await markReminderSkipped(ctx, reminder._id)
    return
  }

  await scheduleAuctionActiveReminder(ctx, reminder._id, scheduledFor)
}

export async function markReminderSent(
  ctx: MutationCtx,
  reminderId: Id<"sponsorshipAuctionReminders">
): Promise<void> {
  await ctx.db.patch("sponsorshipAuctionReminders", reminderId, {
    sent: true,
    sentAt: Date.now(),
  })
}

export async function markReminderSkipped(
  ctx: MutationCtx,
  reminderId: Id<"sponsorshipAuctionReminders">
): Promise<void> {
  await ctx.db.patch("sponsorshipAuctionReminders", reminderId, { sent: true })
}

/** Keep active-auction reminder rows and scheduled jobs aligned with `endsAt`. */
export async function syncAuctionActiveReminders(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">,
  options: {
    createMissing?: boolean
    preserveValidSchedules?: boolean
  } = {}
): Promise<void> {
  if (auction.state !== "active") return

  const createMissing = options.createMissing ?? false
  const scheduledFor = auctionActiveReminderScheduledFor(auction.endsAt)
  const [reminders, invites] = await Promise.all([
    ctx.db
      .query("sponsorshipAuctionReminders")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect(),
    createMissing
      ? ctx.db
          .query("sponsorshipAuctionInvites")
          .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
          .collect()
      : [],
  ])

  if (createMissing) {
    const sponsorsWithReminders = new Set(
      reminders.map((reminder) => reminder.sponsorId)
    )
    for (const invite of invites) {
      if (!sponsorsWithReminders.has(invite.sponsorId)) {
        await createAuctionActiveReminder(
          ctx,
          auction._id,
          invite.sponsorId,
          scheduledFor
        )
      }
    }
  }

  for (const reminder of reminders) {
    if (reminder.sent) continue
    if (scheduledFor > Date.now() && reminder.scheduledFor === scheduledFor) {
      if (!createMissing) continue
      if (
        options.preserveValidSchedules === true &&
        (await isExpectedPendingSchedule(ctx, reminder.scheduledFunctionId, {
          functionReference:
            internal.plugins.sponsor.admin.auctions.lifecycle._fireReminder,
          scheduledTime: scheduledFor,
          argument: ["reminderId", reminder._id],
        }))
      ) {
        continue
      }
    }
    await rescheduleAuctionActiveReminder(ctx, reminder, scheduledFor)
  }
}
