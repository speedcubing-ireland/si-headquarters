import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

export async function scheduleAuctionActiveReminder(
	ctx: MutationCtx,
	reminder: Doc<"sponsorshipAuctionReminders">,
): Promise<void> {
	const scheduledFunctionId = await ctx.scheduler.runAt(
		Math.max(reminder.scheduledFor, Date.now()),
		internal.sponsorshipAuctions._fireReminder,
		{ reminderId: reminder._id },
	);
	await ctx.db.patch("sponsorshipAuctionReminders", reminder._id, {
		scheduledFunctionId,
	});
}

export async function scheduleAuctionActiveRemindersOnActivation(
	ctx: MutationCtx,
	auction: Doc<"sponsorshipAuctions">,
): Promise<void> {
	const now = Date.now();
	const scheduledFor = auction.endsAt - 60 * 60 * 1000;
	const invites = await ctx.db
		.query("sponsorshipAuctionInvites")
		.withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
		.collect();

	for (const invite of invites) {
		const sent = scheduledFor <= now;
		const reminderId = await ctx.db.insert("sponsorshipAuctionReminders", {
			auctionId: auction._id,
			sponsorId: invite.sponsorId,
			scheduledFor,
			sent,
		});
		if (sent) continue;

		const reminder = await ctx.db.get(
			"sponsorshipAuctionReminders",
			reminderId,
		);
		if (reminder) await scheduleAuctionActiveReminder(ctx, reminder);
	}
}

export async function markReminderSent(
	ctx: MutationCtx,
	reminderId: Id<"sponsorshipAuctionReminders">,
): Promise<void> {
	await ctx.db.patch("sponsorshipAuctionReminders", reminderId, {
		sent: true,
		sentAt: Date.now(),
	});
}

export async function markReminderSkipped(
	ctx: MutationCtx,
	reminderId: Id<"sponsorshipAuctionReminders">,
): Promise<void> {
	await ctx.db.patch("sponsorshipAuctionReminders", reminderId, { sent: true });
}
