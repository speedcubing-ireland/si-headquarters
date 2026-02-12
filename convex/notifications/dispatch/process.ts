import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
	EMAIL_CHANNEL,
	EXTERNAL_NOTIFICATION_CHANNELS,
} from "../lib/notificationTypes";
import {
	STALE_DISPATCH_THRESHOLD_MS,
	buildEmailDispatchGroupClaimKey,
	collectDispatchGroup,
	hasEmailDispatchGroupClaim,
	isDispatchDue,
} from "../lib/notificationEmail";
import { getChannelAdapter } from "../channels/registry";

export async function processDispatch(
	ctx: MutationCtx,
	dispatchId: Id<"notificationDispatches">,
): Promise<number> {
	const now = Date.now();
	const seedDispatch = await ctx.db.get("notificationDispatches", dispatchId);
	if (
		!seedDispatch ||
		seedDispatch.status !== "pending" ||
		!isDispatchDue(seedDispatch, now)
	) {
		return 0;
	}

	const dispatchGroup = await collectDispatchGroup(ctx, seedDispatch);
	if (dispatchGroup.length === 0) {
		return 0;
	}

	const dueDispatches: Doc<"notificationDispatches">[] = [];
	for (const dispatch of dispatchGroup) {
		const latest = await ctx.db.get("notificationDispatches", dispatch._id);
		if (!latest || latest.status !== "pending" || !isDispatchDue(latest, now)) {
			continue;
		}
		if (
			seedDispatch.channel === EMAIL_CHANNEL &&
			hasEmailDispatchGroupClaim(latest)
		) {
			continue;
		}
		dueDispatches.push(latest);
	}
	if (dueDispatches.length === 0) {
		return 0;
	}

	const eventIds = [
		...new Set(dueDispatches.map((dispatch) => dispatch.eventId)),
	];
	const metadataJson = JSON.stringify({
		mode: seedDispatch.digestMode,
		channel: seedDispatch.channel,
		eventCount: eventIds.length,
		eventIds,
		digestWindowKey: seedDispatch.digestWindowKey,
		processedAt: now,
	});

	if (seedDispatch.channel === EMAIL_CHANNEL) {
		const claimKey = buildEmailDispatchGroupClaimKey(now, seedDispatch._id);
		for (const dispatch of dueDispatches) {
			await ctx.db.patch("notificationDispatches", dispatch._id, {
				status: "sending",
				reason: claimKey,
				scheduledFor: undefined,
				scheduledFunctionId: undefined,
				lastAttemptAt: now,
				updatedAt: now,
			});
		}
		await ctx.scheduler.runAfter(
			0,
			internal.notifications._sendEmailDispatchGroup,
			{
				dispatchIds: dueDispatches.map((dispatch) => dispatch._id),
				claimKey,
			},
		);
		return dueDispatches.length;
	}

	const channelAdapter = getChannelAdapter(seedDispatch.channel);
	const reason = channelAdapter.isConfigured()
		? "channel_not_implemented"
		: `${seedDispatch.channel}_channel_not_configured`;

	for (const dispatch of dueDispatches) {
		await ctx.db.patch("notificationDispatches", dispatch._id, {
			status: "skipped",
			reason,
			metadataJson,
			attempts: dispatch.attempts + 1,
			lastAttemptAt: now,
			scheduledFunctionId: undefined,
			updatedAt: now,
		});
	}

	return dueDispatches.length;
}

export async function sweepStaleDispatches(ctx: MutationCtx): Promise<number> {
	const now = Date.now();
	let rescheduled = 0;

	for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
		const pendingDispatches = await ctx.db
			.query("notificationDispatches")
			.withIndex("by_channel_status", (q) =>
				q.eq("channel", channel).eq("status", "pending"),
			)
			.collect();

		for (const dispatch of pendingDispatches) {
			if (channel === EMAIL_CHANNEL && hasEmailDispatchGroupClaim(dispatch)) {
				continue;
			}
			if (
				dispatch.scheduledFor !== undefined &&
				dispatch.scheduledFor + STALE_DISPATCH_THRESHOLD_MS < now
			) {
				await ctx.scheduler.runAfter(
					0,
					internal.notifications._processDispatch,
					{
						dispatchId: dispatch._id,
					},
				);
				rescheduled += 1;
			}
		}
	}

	return rescheduled;
}
