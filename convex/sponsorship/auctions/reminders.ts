import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

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
	await Promise.all(
		invites.map((invite) =>
			ctx.db.insert("sponsorshipAuctionReminders", {
				auctionId: auction._id,
				sponsorId: invite.sponsorId,
				scheduledFor,
				sent: scheduledFor <= now,
			}),
		),
	);
}

export async function dueAuctionActiveReminders(
	ctx: MutationCtx,
	now: number,
): Promise<Doc<"sponsorshipAuctionReminders">[]> {
	return ctx.db
		.query("sponsorshipAuctionReminders")
		.withIndex("by_sent_and_scheduled", (q) =>
			q.eq("sent", false).lte("scheduledFor", now),
		)
		.collect();
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
