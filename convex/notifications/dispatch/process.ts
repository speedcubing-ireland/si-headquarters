import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { EXTERNAL_NOTIFICATION_CHANNELS } from "../lib/notificationTypes";
import { collectDispatchGroup, isDispatchDue } from "../lib/notificationEmail";
import {
	buildDispatchGroupClaimKey,
	hasDispatchGroupClaim,
} from "../lib/dispatchClaims";

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
			EXTERNAL_NOTIFICATION_CHANNELS.includes(seedDispatch.channel) &&
			hasDispatchGroupClaim(latest.reason)
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

	if (EXTERNAL_NOTIFICATION_CHANNELS.includes(seedDispatch.channel)) {
		const claimKey = buildDispatchGroupClaimKey(
			seedDispatch.channel,
			now,
			seedDispatch._id,
		);
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
			internal.notifications._sendExternalDispatchGroup,
			{
				dispatchIds: dueDispatches.map((dispatch) => dispatch._id),
				claimKey,
			},
		);
		return dueDispatches.length;
	}

	const reason = "channel_not_implemented";

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
