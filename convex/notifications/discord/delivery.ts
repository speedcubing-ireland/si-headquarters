import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { resolveDiscordChannelForEntity } from "../lib/entities";
import type {
	NotificationEmitInput,
	NotificationType,
} from "../lib/notificationTypes";
import {
	filterChannelWatcherNotificationTypes,
	type WatcherNotificationType,
} from "../lib/watcherPolicy";
import { resolveWatcherNotificationTypes } from "../lib/watcherRecipients";
import { buildDiscordMessagePayload } from "./message";

async function isDiscordDmEnabledForType(
	ctx: MutationCtx,
	userId: Id<"users">,
	type: NotificationType,
): Promise<boolean> {
	const [settings, preference] = await Promise.all([
		ctx.db
			.query("discordNotificationUserSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique(),
		ctx.db
			.query("discordNotificationPreferences")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", userId).eq("type", type),
			)
			.unique(),
	]);
	if (settings?.dmEnabled === false) {
		return false;
	}
	return preference?.enabled ?? true;
}

export async function scheduleDiscordDm(
	ctx: MutationCtx,
	args: {
		recipientId: Id<"users">;
		input: NotificationEmitInput;
	},
): Promise<boolean> {
	const link = await ctx.db
		.query("discordUserLinks")
		.withIndex("by_user", (q) => q.eq("userId", args.recipientId))
		.unique();
	if (!link) {
		return false;
	}
	if (
		!(await isDiscordDmEnabledForType(ctx, args.recipientId, args.input.type))
	) {
		return false;
	}

	const message = await buildDiscordMessagePayload(ctx, {
		input: args.input,
		destinationKind: "dm",
		userId: args.recipientId,
	});

	await ctx.scheduler.runAfter(
		0,
		internal.discord.actions.sendNotificationMessageAction,
		{
			destinationKind: "dm",
			targetId: link.discordUserId,
			title: message.title,
			message: message.message,
			description: message.description,
			url: message.url,
			fields: message.fields,
			author: message.author,
			actions: message.actions,
			priority: message.priority,
		},
	);
	return true;
}

async function resolveGlobalChannelNotificationTypes(
	ctx: MutationCtx,
): Promise<Set<NotificationType>> {
	return (await resolveWatcherNotificationTypes(
		ctx,
		"channel",
	)) as Set<NotificationType>;
}

async function resolveDiscordChannelNotificationTypes(
	ctx: MutationCtx,
	channel: NonNullable<Doc<"competitions">["discordChannel"]>,
): Promise<Set<NotificationType>> {
	const globalTypes = await resolveGlobalChannelNotificationTypes(ctx);
	if (!channel.notificationTypeOverrides) {
		return globalTypes;
	}
	return new Set(
		filterChannelWatcherNotificationTypes(
			channel.notificationTypeOverrides as WatcherNotificationType[],
		) as NotificationType[],
	);
}

export async function scheduleDiscordChannel(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<boolean> {
	const channel = await resolveDiscordChannelForEntity(ctx, input.entity);
	if (!channel) {
		return false;
	}
	const enabledNotificationTypes = await resolveDiscordChannelNotificationTypes(
		ctx,
		channel,
	);
	if (!enabledNotificationTypes.has(input.type)) {
		return false;
	}

	const message = await buildDiscordMessagePayload(ctx, {
		input,
		destinationKind: "channel",
	});

	await ctx.scheduler.runAfter(
		0,
		internal.discord.actions.sendNotificationMessageAction,
		{
			destinationKind: "channel",
			targetId: channel.channelId,
			title: message.title,
			message: message.message,
			description: message.description,
			url: message.url,
			fields: message.fields,
			author: message.author,
			actions: message.actions,
			priority: message.priority,
		},
	);
	return true;
}
