import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"

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

export async function scheduleAuctionActiveReminder(
  ctx: MutationCtx,
  reminder: Doc<"sponsorshipAuctionReminders">
): Promise<void> {
  const scheduledFunctionId = await ctx.scheduler.runAt(
    Math.max(reminder.scheduledFor, Date.now()),
    internal.plugins.sponsor.admin.auctions.lifecycle._fireReminder,
    { reminderId: reminder._id }
  )
  await ctx.db.patch("sponsorshipAuctionReminders", reminder._id, {
    scheduledFunctionId,
  })
}

export async function scheduleAuctionActiveRemindersOnActivation(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  const now = Date.now()
  const scheduledFor = auctionActiveReminderScheduledFor(auction.endsAt)
  const invites = await ctx.db
    .query("sponsorshipAuctionInvites")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
    .collect()

  for (const invite of invites) {
    const sent = scheduledFor <= now
    const reminderId = await ctx.db.insert("sponsorshipAuctionReminders", {
      auctionId: auction._id,
      sponsorId: invite.sponsorId,
      scheduledFor,
      sent,
    })
    if (sent) continue

    const reminder = await ctx.db.get("sponsorshipAuctionReminders", reminderId)
    if (reminder) await scheduleAuctionActiveReminder(ctx, reminder)
  }
}

/** Re-align pending 1-hour reminders when `endsAt` moves (e.g. anti-sniping extension). */
export async function syncActiveRemindersToAuctionEnd(
  ctx: MutationCtx,
  auction: Doc<"sponsorshipAuctions">
): Promise<void> {
  if (auction.state !== "active") return

  const now = Date.now()
  const scheduledFor = auctionActiveReminderScheduledFor(auction.endsAt)
  const reminders = await ctx.db
    .query("sponsorshipAuctionReminders")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
    .collect()

  for (const reminder of reminders) {
    if (reminder.sent) continue

    if (scheduledFor <= now) {
      await cancelScheduledIfPending(ctx, reminder.scheduledFunctionId)
      await markReminderSkipped(ctx, reminder._id)
      continue
    }

    if (reminder.scheduledFor === scheduledFor) continue

    await cancelScheduledIfPending(ctx, reminder.scheduledFunctionId)
    await ctx.db.patch("sponsorshipAuctionReminders", reminder._id, {
      scheduledFor,
      scheduledFunctionId: undefined,
    })
    const updated = await ctx.db.get(
      "sponsorshipAuctionReminders",
      reminder._id
    )
    if (updated) await scheduleAuctionActiveReminder(ctx, updated)
  }
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
