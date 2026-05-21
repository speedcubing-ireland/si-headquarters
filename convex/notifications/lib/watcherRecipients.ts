import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { getEntitySubscriberIds } from "./notificationAccess";
import type {
	NotificationEmitInput,
	NotificationType,
} from "./notificationTypes";
import {
	filterChannelWatcherNotificationTypes,
	getDefaultWatcherNotificationTypes,
	isTargetedNotificationType,
	type NotificationWatcherLevel,
	type WatcherNotificationType,
} from "./watcherPolicy";
import {
	getCompetitionForNotificationEntity,
	getTaskForNotificationEntity,
} from "./entities";

export async function resolveWatcherNotificationTypes(
	ctx: Pick<MutationCtx, "db">,
	level: NotificationWatcherLevel,
): Promise<Set<WatcherNotificationType>> {
	const configured = await ctx.db
		.query("notificationWatcherDefaults")
		.withIndex("by_level", (q) => q.eq("level", level))
		.unique();
	const notificationTypes =
		configured?.notificationTypes ?? getDefaultWatcherNotificationTypes(level);
	return new Set(
		level === "channel"
			? filterChannelWatcherNotificationTypes(
					notificationTypes as WatcherNotificationType[],
				)
			: (notificationTypes as WatcherNotificationType[]),
	);
}

async function isWatcherLevelEnabledForType(
	ctx: Pick<MutationCtx, "db">,
	level: NotificationWatcherLevel,
	type: NotificationType,
): Promise<boolean> {
	return (await resolveWatcherNotificationTypes(ctx, level)).has(type);
}

async function getCompetitionWatcherRecipientIds(
	ctx: Pick<MutationCtx, "db">,
	competition: { _id: Id<"competitions"> } & {
		compLeadId?: Id<"users">;
		leadDelegateId?: Id<"users">;
		organiserIds: Id<"users">[];
	},
): Promise<Id<"users">[]> {
	const recipients = new Set<Id<"users">>();
	if (competition.compLeadId) recipients.add(competition.compLeadId);
	if (competition.leadDelegateId) recipients.add(competition.leadDelegateId);
	for (const organiserId of competition.organiserIds) {
		recipients.add(organiserId);
	}
	for (const subscriberId of await getEntitySubscriberIds(ctx, {
		entityType: "competition",
		entityId: competition._id,
	})) {
		recipients.add(subscriberId);
	}
	return [...recipients];
}

async function getTaskWatcherSubscriberIdsIncludingParents(
	ctx: Pick<MutationCtx, "db">,
	taskId: Id<"tasks">,
): Promise<Id<"users">[]> {
	const subscribers = new Set<Id<"users">>();
	let currentTask = await ctx.db.get("tasks", taskId);
	let depth = 0;
	while (currentTask && depth < 20) {
		for (const subscriberId of await getEntitySubscriberIds(ctx, {
			entityType: "task",
			entityId: currentTask._id,
		})) {
			subscribers.add(subscriberId);
		}
		currentTask = currentTask.parentTaskId
			? await ctx.db.get("tasks", currentTask.parentTaskId)
			: null;
		depth += 1;
	}
	return [...subscribers];
}

export async function expandNotificationRecipientsByWatcherPolicy(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<Id<"users">[]> {
	if (input.forceRecipientDelivery || isTargetedNotificationType(input.type)) {
		return [...new Set(input.recipients)];
	}

	const recipients = new Set(input.recipients);
	const task = await getTaskForNotificationEntity(ctx, input.entity);
	const competition = await getCompetitionForNotificationEntity(
		ctx,
		input.entity,
	);

	if (input.includeEntitySubscribers) {
		for (const subscriberId of await getEntitySubscriberIds(
			ctx,
			input.entity,
		)) {
			recipients.add(subscriberId);
		}
	}

	if (task && (await isWatcherLevelEnabledForType(ctx, "task", input.type))) {
		for (const subscriberId of await getTaskWatcherSubscriberIdsIncludingParents(
			ctx,
			task._id,
		)) {
			recipients.add(subscriberId);
		}
	}

	if (
		competition &&
		(await isWatcherLevelEnabledForType(ctx, "competition", input.type))
	) {
		for (const recipientId of await getCompetitionWatcherRecipientIds(
			ctx,
			competition,
		)) {
			recipients.add(recipientId);
		}
	}

	return [...recipients];
}
