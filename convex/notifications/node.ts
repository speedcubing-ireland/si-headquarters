"use node";

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
	buildNotificationGroupEmailContent,
	buildNotificationGroupIdempotencyKey,
	mapDispatchItemsToEmailGroupItems,
} from "./lib/emailDispatchComposer";
import type { NotificationType } from "./lib/notificationTypes";
import type { EmailDispatchStatus } from "../emailQueue/types";
import {
	buildNotificationGroupSourceRef,
	isQuietHoursDigestWindowKey,
} from "./lib/emailStageGrouping";
import { sendTestEmailPreview } from "./lib/emailPreview";
import { notificationDigestMode } from "./lib/validators";

type ComposeStageResult = {
	staged: number;
	queued: boolean;
};

type ComposeDataItem = {
	type: NotificationType;
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	priority: string;
	actorName?: string;
};

type ComposeData = {
	dueStageIds: Id<"notificationEmailStageItems">[];
	recipientEmail?: string;
	recipientName?: string;
	items: ComposeDataItem[];
};

type FinalizeResult = {
	staged: number;
};

type EnqueueResult = {
	dispatchId: Id<"emailDispatches">;
	dedupeKey: string;
	status: EmailDispatchStatus;
	created: boolean;
};

export const _composeNotificationEmailStageGroup = internalAction({
	args: {
		userId: v.id("users"),
		digestMode: notificationDigestMode,
		digestWindowKey: v.optional(v.string()),
	},
	returns: v.object({
		staged: v.number(),
		queued: v.boolean(),
	}),
	handler: async (ctx, args): Promise<ComposeStageResult> => {
		const composeData: ComposeData = await ctx.runQuery(
			internal.notifications.internal
				._getNotificationEmailStageGroupComposeData,
			args,
		);
		if (composeData.dueStageIds.length === 0) {
			return { staged: 0, queued: false };
		}

		if (!composeData.recipientEmail || composeData.items.length === 0) {
			const finalized: FinalizeResult = await ctx.runMutation(
				internal.notifications.internal
					._finalizeNotificationEmailStageGroupCompose,
				{
					...args,
					dueStageIds: composeData.dueStageIds,
					status: "skipped",
				},
			);
			return { staged: finalized.staged, queued: false };
		}

		const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
		const composed = await buildNotificationGroupEmailContent({
			digestMode: args.digestMode,
			isQuietHoursBatch:
				args.digestMode === "immediate" &&
				isQuietHoursDigestWindowKey(args.digestWindowKey),
			items: mapDispatchItemsToEmailGroupItems({
				appUrl,
				items: composeData.items,
			}),
			appUrl,
		});
		const queued: EnqueueResult = await ctx.runMutation(
			internal.emailQueue._enqueueDispatch,
			{
				dedupeKey: buildNotificationGroupIdempotencyKey({
					digestMode: args.digestMode,
					digestWindowKey: args.digestWindowKey,
					recipientEmail: composeData.recipientEmail,
				}),
				sourceKind: "notification",
				sourceRef: buildNotificationGroupSourceRef({
					userId: args.userId,
					digestMode: args.digestMode,
					digestWindowKey: args.digestWindowKey,
				}),
				templateKey: composed.emailType,
				recipientEmail: composeData.recipientEmail,
				recipientName: composeData.recipientName,
				subject: composed.subject,
				htmlBody: composed.htmlBody,
				plainTextBody: composed.plainTextBody,
				payloadJson: JSON.stringify({
					userId: args.userId,
					digestMode: args.digestMode,
					digestWindowKey: args.digestWindowKey,
					stageIds: composeData.dueStageIds,
				}),
			},
		);

		const finalized: FinalizeResult = await ctx.runMutation(
			internal.notifications.internal
				._finalizeNotificationEmailStageGroupCompose,
			{
				...args,
				dueStageIds: composeData.dueStageIds,
				status: "composed",
				emailDispatchId: queued.dispatchId,
			},
		);
		return {
			staged: finalized.staged,
			queued: queued.created,
		};
	},
});

export const _sendTestEmail = internalAction({
	args: {
		type: v.union(
			v.literal("immediate"),
			v.literal("hourly"),
			v.literal("three_daily"),
		),
		toEmail: v.string(),
		recipientName: v.optional(v.string()),
		actorName: v.string(),
	},
	returns: v.null(),
	handler: async (_ctx, args): Promise<null> => {
		await sendTestEmailPreview(args);
		return null;
	},
});
