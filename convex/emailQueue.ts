import { ConvexError, v } from "convex/values";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { enqueueDispatch } from "./emailQueue/enqueue";
import {
	listRecentDeadLetters,
	getDispatchHealth,
} from "./emailQueue/diagnostics";
import {
	sendDispatch,
	runSweep,
	markSent,
	markSubmitted,
	deadLetter,
	claimDispatchForSend,
	prepareDispatchSendAttempt,
} from "./emailQueue/worker";
import {
	emailDispatchStatus,
	emailDispatchHealthReturns,
	emailDeadLetterRecordReturns,
	emailSourceKind,
} from "./emailQueue/types";

export const _claimDispatchForSend = internalMutation({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => claimDispatchForSend(ctx, args),
});

export const _prepareDispatchSendAttempt = internalMutation({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
	},
	returns: v.union(v.null(), v.string()),
	handler: async (ctx, args) => prepareDispatchSendAttempt(ctx, args),
});

export const _enqueueDispatch = internalMutation({
	args: {
		dedupeKey: v.string(),
		sourceKind: emailSourceKind,
		sourceRef: v.optional(v.string()),
		templateKey: v.string(),
		recipientEmail: v.string(),
		recipientName: v.optional(v.string()),
		senderAddress: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.optional(v.string()),
		plainTextBody: v.string(),
		payloadJson: v.optional(v.string()),
		scheduledFor: v.optional(v.number()),
		forceResend: v.optional(v.boolean()),
		replaySuffix: v.optional(v.string()),
	},
	returns: v.object({
		dispatchId: v.id("emailDispatches"),
		dedupeKey: v.string(),
		status: emailDispatchStatus,
		created: v.boolean(),
	}),
	handler: async (ctx, args) => enqueueDispatch(ctx, args),
});

export const _getDispatchForClaim = internalQuery({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("emailDispatches"),
			dedupeKey: v.string(),
			sourceKind: emailSourceKind,
			sourceRef: v.optional(v.string()),
			templateKey: v.string(),
			recipientEmail: v.string(),
			recipientName: v.optional(v.string()),
			senderAddress: v.optional(v.string()),
			subject: v.string(),
			htmlBody: v.optional(v.string()),
			plainTextBody: v.string(),
			payloadJson: v.optional(v.string()),
			scheduledFor: v.number(),
			status: emailDispatchStatus,
			claimKey: v.optional(v.string()),
			providerOperationId: v.string(),
			providerStatus: v.optional(v.string()),
			sendAttemptCount: v.number(),
			pollAttemptCount: v.number(),
			lastProviderCheckAt: v.optional(v.number()),
			sentAt: v.optional(v.number()),
			error: v.optional(v.string()),
			deadLetteredAt: v.optional(v.number()),
			createdAt: v.number(),
			updatedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
		if (!dispatch || dispatch.claimKey !== args.claimKey) {
			return null;
		}
		if (
			dispatch.status !== "sending" &&
			dispatch.status !== "awaiting_provider"
		) {
			return null;
		}
		return {
			_id: dispatch._id,
			dedupeKey: dispatch.dedupeKey,
			sourceKind: dispatch.sourceKind,
			sourceRef: dispatch.sourceRef,
			templateKey: dispatch.templateKey,
			recipientEmail: dispatch.recipientEmail,
			recipientName: dispatch.recipientName,
			senderAddress: dispatch.senderAddress,
			subject: dispatch.subject,
			htmlBody: dispatch.htmlBody,
			plainTextBody: dispatch.plainTextBody,
			payloadJson: dispatch.payloadJson,
			scheduledFor: dispatch.scheduledFor,
			status: dispatch.status,
			claimKey: dispatch.claimKey,
			providerOperationId: dispatch.providerOperationId,
			providerStatus: dispatch.providerStatus,
			sendAttemptCount: dispatch.sendAttemptCount,
			pollAttemptCount: dispatch.pollAttemptCount,
			lastProviderCheckAt: dispatch.lastProviderCheckAt,
			sentAt: dispatch.sentAt,
			error: dispatch.error,
			deadLetteredAt: dispatch.deadLetteredAt,
			createdAt: dispatch.createdAt,
			updatedAt: dispatch.updatedAt,
		};
	},
});

export const _runSweep = internalMutation({
	args: {},
	returns: v.object({
		claimed: v.number(),
		polled: v.number(),
		staleQueued: v.number(),
	}),
	handler: async (ctx) => runSweep(ctx),
});

export const _sendDispatch = internalAction({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await sendDispatch(ctx, args);
		return null;
	},
});

export const _markSent = internalMutation({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
		providerStatus: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await markSent(ctx, args);
		return null;
	},
});

export const _markSubmitted = internalMutation({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
		providerStatus: v.string(),
		providerOperationId: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => markSubmitted(ctx, args),
});

export const _applyDeliveryEvent = internalMutation({
	args: {
		providerOperationId: v.string(),
		providerStatus: v.string(),
		statusMessage: v.optional(v.string()),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db
			.query("emailDispatches")
			.withIndex("by_provider_operation_id", (q) =>
				q.eq("providerOperationId", args.providerOperationId),
			)
			.first();
		if (!dispatch) return false;
		if (
			dispatch.status === "dead_letter" ||
			dispatch.status === "canceled" ||
			dispatch.status === "delivered" ||
			dispatch.status === "bounced" ||
			dispatch.status === "quarantined" ||
			dispatch.status === "filtered_spam" ||
			dispatch.status === "failed_delivery" ||
			dispatch.status === "suppressed"
		) {
			return true;
		}

		let nextStatus:
			| "delivered"
			| "suppressed"
			| "bounced"
			| "quarantined"
			| "filtered_spam"
			| "failed_delivery"
			| "submitted" = "submitted";
		switch (args.providerStatus) {
			case "Delivered":
				nextStatus = "delivered";
				break;
			case "Suppressed":
				nextStatus = "suppressed";
				break;
			case "Bounced":
				nextStatus = "bounced";
				break;
			case "Quarantined":
				nextStatus = "quarantined";
				break;
			case "FilteredSpam":
				nextStatus = "filtered_spam";
				break;
			case "Failed":
				nextStatus = "failed_delivery";
				break;
			case "Expanded":
				nextStatus = "submitted";
				break;
			default:
				nextStatus = "submitted";
		}

		await ctx.db.patch("emailDispatches", dispatch._id, {
			status: nextStatus,
			providerStatus: args.providerStatus,
			error: args.statusMessage,
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const _migrateLegacyDispatchStatuses = internalMutation({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.object({
		migratedSentToSubmitted: v.number(),
		deadLetteredAwaitingProvider: v.number(),
	}),
	handler: async (ctx, args) => {
		const limit = args.limit ? Math.max(1, Math.min(args.limit, 500)) : 200;
		let migratedSentToSubmitted = 0;
		let deadLetteredAwaitingProvider = 0;

		const sentRows = await ctx.db
			.query("emailDispatches")
			.withIndex("by_status_updated_at", (q) => q.eq("status", "sent"))
			.order("asc")
			.take(limit);
		for (const dispatch of sentRows) {
			await ctx.db.patch("emailDispatches", dispatch._id, {
				status: "submitted",
				updatedAt: Date.now(),
			});
			migratedSentToSubmitted += 1;
		}

		const awaitingRows = await ctx.db
			.query("emailDispatches")
			.withIndex("by_status_updated_at", (q) =>
				q.eq("status", "awaiting_provider"),
			)
			.order("asc")
			.take(limit);
		for (const dispatch of awaitingRows) {
			await deadLetter(ctx, {
				dispatch,
				error: "legacy_polling_removed",
				providerStatus: dispatch.providerStatus ?? "unknown",
			});
			deadLetteredAwaitingProvider += 1;
		}

		return { migratedSentToSubmitted, deadLetteredAwaitingProvider };
	},
});

export const _deadLetter = internalMutation({
	args: {
		dispatchId: v.id("emailDispatches"),
		claimKey: v.string(),
		error: v.string(),
		providerStatus: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const dispatch = await ctx.db.get("emailDispatches", args.dispatchId);
		if (
			!dispatch ||
			dispatch.claimKey !== args.claimKey ||
			(dispatch.status !== "sending" && dispatch.status !== "awaiting_provider")
		) {
			return null;
		}
		await deadLetter(ctx, {
			dispatch,
			error: args.error,
			providerStatus: args.providerStatus,
		});
		return null;
	},
});

async function replayDeadLetter(
	ctx: MutationCtx,
	deadLetterId: Id<"emailDeadLetters">,
): Promise<{ dispatchId: Id<"emailDispatches">; dedupeKey: string }> {
	const dead = await ctx.db.get("emailDeadLetters", deadLetterId);
	if (!dead) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Dead letter not found.",
		});
	}
	const sourceDispatch = await ctx.db.get("emailDispatches", dead.dispatchId);
	if (!sourceDispatch) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Original dispatch not found.",
		});
	}
	const replayCount = dead.replayCount + 1;
	await ctx.db.patch("emailDeadLetters", dead._id, { replayCount });
	const replaySuffix = `replay:${replayCount}:${Date.now()}`;
	const result = await enqueueDispatch(ctx, {
		dedupeKey: sourceDispatch.dedupeKey,
		sourceKind: sourceDispatch.sourceKind,
		sourceRef: sourceDispatch.sourceRef ?? dead.sourceRef,
		templateKey: sourceDispatch.templateKey,
		recipientEmail: sourceDispatch.recipientEmail,
		recipientName: sourceDispatch.recipientName,
		senderAddress: sourceDispatch.senderAddress,
		subject: sourceDispatch.subject,
		htmlBody: sourceDispatch.htmlBody,
		plainTextBody: sourceDispatch.plainTextBody,
		payloadJson: sourceDispatch.payloadJson ?? dead.payloadJson,
		scheduledFor: Date.now(),
		forceResend: true,
		replaySuffix,
	});
	if (!result.created) {
		throw new ConvexError({
			code: "INTERNAL",
			message: "Replay enqueue failed.",
		});
	}
	return {
		dispatchId: result.dispatchId,
		dedupeKey: result.dedupeKey,
	};
}

export const _replayDeadLetter = internalMutation({
	args: {
		deadLetterId: v.id("emailDeadLetters"),
	},
	returns: v.object({
		dispatchId: v.id("emailDispatches"),
		dedupeKey: v.string(),
	}),
	handler: async (ctx, args) => replayDeadLetter(ctx, args.deadLetterId),
});

export async function queryEmailDispatchHealth(ctx: QueryCtx) {
	return getDispatchHealth(ctx);
}

export async function queryRecentEmailDeadLetters(
	ctx: QueryCtx,
	args?: {
		limit?: number;
		sourceKind?: "sponsorship" | "notification" | "sponsor_auth";
	},
) {
	return listRecentDeadLetters(ctx, args);
}

export const emailDispatchHealthValidator = emailDispatchHealthReturns;
export const emailDeadLetterValidator = emailDeadLetterRecordReturns;
