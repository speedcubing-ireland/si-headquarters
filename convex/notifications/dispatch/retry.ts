import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { patchPendingDispatches } from "../lib/notificationEmail";

type MarkDispatchesSentArgs = {
	dispatchIds: Id<"notificationDispatches">[];
	claimKey?: string;
};

type MarkDispatchesInProgressArgs = {
	dispatchIds: Id<"notificationDispatches">[];
	claimKey?: string;
	reason?: string;
};

type MarkDispatchesFailedArgs = {
	dispatchIds: Id<"notificationDispatches">[];
	reason: string;
	claimKey?: string;
};

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

export async function markDispatchesInProgress(
	ctx: MutationCtx,
	args: MarkDispatchesInProgressArgs,
): Promise<void> {
	const now = Date.now();
	for (const dispatchId of args.dispatchIds) {
		const dispatch = await ctx.db.get("notificationDispatches", dispatchId);
		if (
			!dispatch ||
			dispatch.status !== "sending" ||
			(args.claimKey !== undefined && dispatch.reason !== args.claimKey)
		) {
			continue;
		}
		await ctx.db.patch("notificationDispatches", dispatch._id, {
			reason: args.reason ?? dispatch.reason,
			lastAttemptAt: now,
			updatedAt: now,
		});
	}
}

export async function markDispatchesFailed(
	ctx: MutationCtx,
	args: MarkDispatchesFailedArgs,
): Promise<void> {
	const eligibleDispatches: Array<Doc<"notificationDispatches">> = [];
	const canceledScheduledFunctionIds = new Set<Id<"_scheduled_functions">>();
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
