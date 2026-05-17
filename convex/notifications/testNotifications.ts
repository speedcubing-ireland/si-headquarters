import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireUserId } from "../core/auth";

export const sendAllTestNotifications = mutation({
	args: {},
	returns: v.array(v.string()),
	handler: async (ctx) => {
		await requireUserId(ctx);

		const discordLink = await ctx.runQuery(
			api.discord.api.getCurrentUserSettings,
			{},
		);

		if (!discordLink.link) {
			return [
				"Skipped: No Discord account linked. Link your Discord account in settings first.",
			];
		}

		const results: string[] = [];
		const targetId = discordLink.link.discordUserId;

		const testMessages = [
			{
				title: "Task Assigned",
				message:
					"You've been assigned to HQ-101: Design social media graphics for the upcoming competition.",
			},
			{
				title: "Task Unassigned",
				message:
					"You've been unassigned from HQ-102: Update volunteer schedule.",
			},
			{
				title: "Status Changed",
				message: "HQ-103: Print banners moved from To Do → In Progress.",
			},
			{
				title: "Priority Changed",
				message:
					"HQ-104: Order trophies priority changed from Medium → Urgent.",
			},
			{
				title: "Awaiting Review",
				message: "HQ-105: Setup registration desk is awaiting your review.",
			},
			{
				title: "Task Approved",
				message: "HQ-106: Create name badges has been approved.",
			},
			{
				title: "Approval Withdrawn",
				message: "HQ-107: Order timing mats approval was withdrawn.",
			},
			{
				title: "Due Date Changed",
				message: "HQ-108: Finalize judge schedule due date set to 2026-12-01.",
			},
			{
				title: "Task Blocked",
				message:
					"HQ-109: Setup venue is now blocked by HQ-110: Receive equipment shipment.",
			},
			{
				title: "Task Unblocked",
				message: "HQ-109: Setup venue is no longer blocked.",
			},
			{
				title: "Phase Changed",
				message: "Cork Open 2026 moved from Planning → Execution phase.",
			},
			{
				title: "Progress Update",
				message:
					"A new on-track progress update was posted for Cork Open 2026.",
			},
		];

		for (const msg of testMessages) {
			try {
				await ctx.scheduler.runAfter(
					0,
					internal.discord.actions.sendNotificationMessageAction,
					{
						destinationKind: "dm",
						targetId,
						title: msg.title,
						message: msg.message,
						actions: [
							{
								customId: "test_dismiss",
								label: "Dismiss",
								style: 2,
							},
						],
						priority: "normal" as const,
					},
				);
				results.push(`${msg.title}: sent`);
			} catch (error) {
				results.push(
					`${msg.title}: failed - ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		return results;
	},
});
