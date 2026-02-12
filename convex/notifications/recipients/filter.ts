import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { canUserAccessNotificationEntity } from "../../lib/notificationAccess";
import { getNotificationPreferenceConfig } from "../../lib/notificationSettings";
import {
	IN_APP_CHANNEL,
	type NotificationEmitInput,
	type NotificationEntityType,
	type NotificationType,
	type RecipientDecision,
} from "../../lib/notificationTypes";

async function hasUnreadBatchNotification(
	ctx: Pick<MutationCtx, "db">,
	args: {
		userId: Id<"users">;
		type: NotificationType;
		entityType: NotificationEntityType;
		entityId: string;
		batchKey: string;
	},
): Promise<boolean> {
	const docs = await ctx.db
		.query("notifications")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", args.entityType).eq("entityId", args.entityId),
		)
		.collect();

	return docs.some(
		(doc) =>
			doc.userId === args.userId &&
			doc.type === args.type &&
			doc.batchKey === args.batchKey &&
			doc.status === "unread",
	);
}

export async function decideRecipientHandling(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		recipientId: Id<"users">;
		eventId: Id<"notificationEvents">;
		entityId: string;
		suppressActorRecipient: boolean;
	},
): Promise<RecipientDecision> {
	const existingNotification = await ctx.db
		.query("notifications")
		.withIndex("by_user_source_event", (q) =>
			q.eq("userId", args.recipientId).eq("sourceEventId", args.eventId),
		)
		.first();
	if (existingNotification) {
		return {
			kind: "existing",
			notification: existingNotification,
		};
	}

	if (
		args.suppressActorRecipient &&
		args.input.actorId &&
		args.recipientId === args.input.actorId
	) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "skipped",
				reason: "self_action",
			},
		};
	}

	const hasAccess = await canUserAccessNotificationEntity(
		ctx,
		args.recipientId,
		args.input.entity,
	);
	if (!hasAccess) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "skipped",
				reason: "no_access",
			},
		};
	}

	const inAppPreference = await getNotificationPreferenceConfig(
		ctx,
		args.recipientId,
		args.input.type,
		IN_APP_CHANNEL,
	);
	if (!inAppPreference.enabled) {
		return {
			kind: "skip",
			skip: {
				inAppStatus: "skipped",
				externalStatus: "pending",
				reason: "preference_disabled",
			},
		};
	}

	if (args.input.isBatchable && args.input.batchKey) {
		const hasExistingBatchNotification = await hasUnreadBatchNotification(ctx, {
			userId: args.recipientId,
			type: args.input.type,
			entityType: args.input.entity.entityType,
			entityId: args.entityId,
			batchKey: args.input.batchKey,
		});
		if (hasExistingBatchNotification) {
			return {
				kind: "skip",
				skip: {
					inAppStatus: "skipped",
					externalStatus: "skipped",
					reason: "batch_deduped",
				},
			};
		}
	}

	return {
		kind: "deliver",
		inAppPreference,
	};
}
