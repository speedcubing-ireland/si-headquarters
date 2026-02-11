import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { NOTIFICATION_TYPES } from "./validators";
import { validateTimezone } from "./notificationScheduling";
import { toISO } from "./transforms";
import { validateQuietHours } from "./notificationHelpers";
import {
	IN_APP_CHANNEL,
	SUPPORTED_NOTIFICATION_CHANNELS,
	DEFAULT_DIGEST_MODE,
	DEFAULT_TIMEZONE,
	type NotificationChannel,
	type NotificationDigestMode,
	type NotificationType,
	type NotificationPreferenceConfig,
	type DbReadCtx,
	type NotificationUserSettingsResolved,
} from "./notificationTypes";



export async function getNotificationUserSettingsDoc(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<Doc<"notificationUserSettings"> | null> {
	return ctx.db
		.query("notificationUserSettings")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
}

export function resolveNotificationUserSettings(
	doc: Doc<"notificationUserSettings"> | null,
): NotificationUserSettingsResolved {
	return {
		timezone: doc?.timezone ?? DEFAULT_TIMEZONE,
		defaultDigestMode: doc?.defaultDigestMode ?? DEFAULT_DIGEST_MODE,
		quietHoursStartMin: doc?.quietHoursStartMin,
		quietHoursEndMin: doc?.quietHoursEndMin,
		updatedAt: doc?.updatedAt ?? 0,
	};
}

export async function getResolvedNotificationUserSettings(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<NotificationUserSettingsResolved> {
	const doc = await getNotificationUserSettingsDoc(ctx, userId);
	return resolveNotificationUserSettings(doc);
}

export async function getNotificationUserTimezone(
	ctx: DbReadCtx,
	userId: Id<"users">,
): Promise<string> {
	const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
	return userSettings.timezone;
}

export async function upsertNotificationUserSettings(
	ctx: MutationCtx,
	userId: Id<"users">,
	args: {
		timezone?: string;
		defaultDigestMode?: NotificationDigestMode;
		quietHoursStartMin?: number;
		quietHoursEndMin?: number;
		clearQuietHours?: boolean;
	},
): Promise<void> {
	const existing = await getNotificationUserSettingsDoc(ctx, userId);
	const resolved = resolveNotificationUserSettings(existing);

	const timezone = args.timezone ?? resolved.timezone;
	const defaultDigestMode =
		args.defaultDigestMode ?? resolved.defaultDigestMode;
	if (args.timezone !== undefined) {
		validateTimezone(args.timezone);
	}

	let quietHoursStartMin = resolved.quietHoursStartMin;
	let quietHoursEndMin = resolved.quietHoursEndMin;
	if (args.clearQuietHours) {
		quietHoursStartMin = undefined;
		quietHoursEndMin = undefined;
	} else if (
		args.quietHoursStartMin !== undefined ||
		args.quietHoursEndMin !== undefined
	) {
		quietHoursStartMin = args.quietHoursStartMin;
		quietHoursEndMin = args.quietHoursEndMin;
	}
	validateQuietHours(quietHoursStartMin, quietHoursEndMin);

	const now = Date.now();
	if (existing) {
		await ctx.db.patch("notificationUserSettings", existing._id, {
			timezone,
			defaultDigestMode,
			quietHoursStartMin,
			quietHoursEndMin,
			updatedAt: now,
		});
		return;
	}
	await ctx.db.insert("notificationUserSettings", {
		userId,
		timezone,
		defaultDigestMode,
		quietHoursStartMin,
		quietHoursEndMin,
		updatedAt: now,
	});
}



export function defaultChannelEnabled(channel: NotificationChannel): boolean {
	return channel === IN_APP_CHANNEL;
}

export function assertSupportedChannel(channel: NotificationChannel): void {
	if (SUPPORTED_NOTIFICATION_CHANNELS.includes(channel)) {
		return;
	}
	throw new ConvexError({
		code: "BAD_REQUEST",
		message: `${channel} notifications are not yet supported`,
	});
}

export async function getNotificationPreferenceConfig(
	ctx: Pick<MutationCtx, "db">,
	userId: Id<"users">,
	type: NotificationType,
	channel: NotificationChannel,
): Promise<NotificationPreferenceConfig> {
	const [override, userSettings] = await Promise.all([
		ctx.db
			.query("notificationPreferences")
			.withIndex("by_user_type_channel", (q) =>
				q.eq("userId", userId).eq("type", type).eq("channel", channel),
			)
			.first(),
		getResolvedNotificationUserSettings(ctx, userId),
	]);
	const respectQuietHours = override?.respectQuietHours ?? true;
	const effectiveDigestMode =
		channel === IN_APP_CHANNEL
			? override
				? "immediate"
				: userSettings.defaultDigestMode
			: (override?.digestMode ?? userSettings.defaultDigestMode);

	return {
		enabled: override?.enabled ?? defaultChannelEnabled(channel),
		digestMode: effectiveDigestMode,
		respectQuietHours,
		quietHoursStartMin: respectQuietHours
			? userSettings.quietHoursStartMin
			: undefined,
		quietHoursEndMin: respectQuietHours
			? userSettings.quietHoursEndMin
			: undefined,
	};
}



export async function buildPreferenceRowsForUser(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
	userSettings?: NotificationUserSettingsResolved,
): Promise<
	Array<{
		type: NotificationType;
		channel: NotificationChannel;
		enabled: boolean;
		digestMode: NotificationDigestMode;
		respectQuietHours: boolean;
		isOverride: boolean;
		updatedAt: string;
	}>
> {
	const resolvedUserSettings =
		userSettings ?? (await getResolvedNotificationUserSettings(ctx, userId));
	const overrides = await ctx.db
		.query("notificationPreferences")
		.withIndex("by_user_type_channel", (q) => q.eq("userId", userId))
		.collect();

	const overrideMap = new Map<string, Doc<"notificationPreferences">>();
	for (const override of overrides) {
		overrideMap.set(`${override.type}:${override.channel}`, override);
	}

	const preferences: Array<{
		type: NotificationType;
		channel: NotificationChannel;
		enabled: boolean;
		digestMode: NotificationDigestMode;
		respectQuietHours: boolean;
		isOverride: boolean;
		updatedAt: string;
	}> = [];

	for (const type of NOTIFICATION_TYPES) {
		for (const channel of SUPPORTED_NOTIFICATION_CHANNELS) {
			const key = `${type}:${channel}`;
			const override = overrideMap.get(key);
			const isOverride = override !== undefined;
			const digestMode =
				channel === IN_APP_CHANNEL
					? isOverride
						? "immediate"
						: resolvedUserSettings.defaultDigestMode
					: (override?.digestMode ?? resolvedUserSettings.defaultDigestMode);
			preferences.push({
				type,
				channel,
				enabled: override?.enabled ?? defaultChannelEnabled(channel),
				digestMode,
				respectQuietHours: override?.respectQuietHours ?? true,
				isOverride,
				updatedAt: override
					? toISO(override.updatedAt)
					: toISO(resolvedUserSettings.updatedAt),
			});
		}
	}

	return preferences;
}

export async function upsertNotificationPreferenceOverride(
	ctx: MutationCtx,
	args: {
		userId: Id<"users">;
		type: NotificationType;
		channel: NotificationChannel;
		enabled?: boolean;
		digestMode?: NotificationDigestMode;
		respectQuietHours?: boolean;
		clearOverride?: boolean;
		defaultDigestMode?: NotificationDigestMode;
	},
): Promise<void> {
	assertSupportedChannel(args.channel);
	const existing = await ctx.db
		.query("notificationPreferences")
		.withIndex("by_user_type_channel", (q) =>
			q
				.eq("userId", args.userId)
				.eq("type", args.type)
				.eq("channel", args.channel),
		)
		.first();

	if (args.clearOverride) {
		if (existing) {
			await ctx.db.delete("notificationPreferences", existing._id);
		}
		return;
	}

	const respectQuietHours =
		args.respectQuietHours ?? existing?.respectQuietHours ?? true;

	const fallbackDigestMode = args.defaultDigestMode ?? DEFAULT_DIGEST_MODE;
	const digestMode =
		args.channel === IN_APP_CHANNEL
			? "immediate"
			: (args.digestMode ?? existing?.digestMode ?? fallbackDigestMode);
	const enabled =
		args.enabled ?? existing?.enabled ?? defaultChannelEnabled(args.channel);

	const now = Date.now();
	if (existing) {
		await ctx.db.patch("notificationPreferences", existing._id, {
			enabled,
			digestMode,
			respectQuietHours,
			updatedAt: now,
		});
		return;
	}

	await ctx.db.insert("notificationPreferences", {
		userId: args.userId,
		type: args.type,
		channel: args.channel,
		enabled,
		digestMode,
		respectQuietHours,
		updatedAt: now,
	});
}

export function formatUserSettings(settings: NotificationUserSettingsResolved) {
	return {
		timezone: settings.timezone,
		defaultDigestMode: settings.defaultDigestMode,
		quietHoursStartMin: settings.quietHoursStartMin,
		quietHoursEndMin: settings.quietHoursEndMin,
		updatedAt: toISO(settings.updatedAt),
	};
}
