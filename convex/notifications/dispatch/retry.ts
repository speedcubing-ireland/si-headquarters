import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { patchPendingDispatches } from "../lib/notificationEmail";

type MarkDispatchesSentArgs = {
	dispatchIds: Id<"notificationDispatches">[];
	claimKey?: string;
};

type MarkDispatchesFailedArgs = {
	dispatchIds: Id<"notificationDispatches">[];
	reason: string;
	claimKey?: string;
};

const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1000;

function computeRetryDelayMs(nextAttempt: number): number {
	const exponent = Math.max(0, nextAttempt - 1);
	return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
}

async function scheduleDispatchRetry(
	ctx: MutationCtx,
	dispatchId: Id<"notificationDispatches">,
	scheduledFor: number,
): Promise<void> {
	const scheduledFunctionId = await ctx.scheduler.runAt(
		scheduledFor,
		internal.notifications._processDispatch,
		{ dispatchId },
	);
	const latest = await ctx.db.get("notificationDispatches", dispatchId);
	if (!latest || latest.status !== "pending") {
		await ctx.scheduler.cancel(scheduledFunctionId);
		return;
	}
	await ctx.db.patch("notificationDispatches", dispatchId, {
		scheduledFunctionId,
		updatedAt: Date.now(),
	});
}

export async function markDispatchesSent(
	ctx: MutationCtx,
	args: MarkDispatchesSentArgs,
): Promise<void> {
	await patchPendingDispatches(
		ctx,
		args.dispatchIds,
		"sent",
		undefined,
		args.claimKey,
	);
}

export async function markDispatchesFailed(
	ctx: MutationCtx,
	args: MarkDispatchesFailedArgs,
): Promise<void> {
	const eligibleDispatches: Array<Doc<"notificationDispatches">> = [];
	const canceledScheduledFunctionIds = new Set<Id<"_scheduled_functions">>();
	const isClaimFlow = args.claimKey !== undefined;
	for (const dispatchId of args.dispatchIds) {
		const dispatch = await ctx.db.get("notificationDispatches", dispatchId);
		if (
			!dispatch ||
			(dispatch.status !== "pending" && dispatch.status !== "sending") ||
			(args.claimKey !== undefined && dispatch.reason !== args.claimKey)
		) {
			continue;
		}
		if (
			dispatch.scheduledFunctionId &&
			!canceledScheduledFunctionIds.has(dispatch.scheduledFunctionId)
		) {
			await ctx.scheduler.cancel(dispatch.scheduledFunctionId);
			canceledScheduledFunctionIds.add(dispatch.scheduledFunctionId);
		}
		eligibleDispatches.push(dispatch);
	}

	const now = Date.now();
	for (const dispatch of eligibleDispatches) {
		const nextAttempt = dispatch.attempts + 1;
		const hasAttemptsRemaining =
			!isClaimFlow && nextAttempt < dispatch.maxAttempts;

		if (hasAttemptsRemaining) {
			const scheduledFor = now + computeRetryDelayMs(nextAttempt);
			await ctx.db.patch("notificationDispatches", dispatch._id, {
				status: "pending",
				reason: args.reason,
				attempts: nextAttempt,
				scheduledFor,
				lastAttemptAt: now,
				scheduledFunctionId: undefined,
				updatedAt: now,
			});
			await scheduleDispatchRetry(ctx, dispatch._id, scheduledFor);
			continue;
		}

		await ctx.db.patch("notificationDispatches", dispatch._id, {
			status: "failed",
			reason: args.reason,
			attempts: nextAttempt,
			scheduledFor: undefined,
			lastAttemptAt: now,
			scheduledFunctionId: undefined,
			updatedAt: now,
		});
		await ctx.db.insert("notificationDeadLetters", {
			dispatchId: dispatch._id,
			eventId: dispatch.eventId,
			userId: dispatch.userId,
			channel: dispatch.channel,
			error: args.reason,
			attempts: nextAttempt,
			payloadJson: dispatch.metadataJson,
			failedAt: now,
		});
	}
}
