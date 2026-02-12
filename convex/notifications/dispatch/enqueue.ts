import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { computeDispatchSchedule } from "../lib/notificationScheduling";
import {
	getNotificationPreferenceConfig,
	getNotificationUserTimezone,
} from "../lib/notificationSettings";
import {
	DEFAULT_DIGEST_MODE,
	EXTERNAL_NOTIFICATION_CHANNELS,
	IN_APP_CHANNEL,
	type DispatchStatus,
	type NotificationChannel,
	type NotificationDigestMode,
	type NotificationType,
	type ScheduledFunctionId,
} from "../lib/notificationTypes";

const DEFAULT_DISPATCH_MAX_ATTEMPTS = 5;

type UpsertDispatchArgs = {
	eventId: Id<"notificationEvents">;
	userId: Id<"users">;
	channel: NotificationChannel;
	status: DispatchStatus;
	digestMode?: NotificationDigestMode;
	scheduledFor?: number;
	digestWindowKey?: string;
	notificationId?: Id<"notifications">;
	reason?: string;
	metadataJson?: string;
};

type UpsertEnabledExternalDispatchesArgs = {
	eventId: Id<"notificationEvents">;
	userId: Id<"users">;
	type: NotificationType;
	status: DispatchStatus;
	notificationId?: Id<"notifications">;
	metadataJson?: string;
	reason?: string;
};

type SkipRecipientArgs = {
	eventId: Id<"notificationEvents">;
	recipientId: Id<"users">;
	type: NotificationType;
	inAppStatus: DispatchStatus;
	externalStatus: DispatchStatus;
	reason: string;
	externalReason?: string;
	externalMetadataJson?: string;
};

function shouldScheduleDispatchProcessing(
	status: DispatchStatus,
	scheduledFor: number | undefined,
): scheduledFor is number {
	return status === "pending" && scheduledFor !== undefined;
}

async function scheduleDispatchProcessing(
	ctx: MutationCtx,
	dispatchId: Id<"notificationDispatches">,
	scheduledFor: number,
): Promise<ScheduledFunctionId> {
	return ctx.scheduler.runAt(
		scheduledFor,
		internal.notifications._processDispatch,
		{
			dispatchId,
		},
	);
}

async function attachDispatchScheduleIfPending(
	ctx: MutationCtx,
	dispatchId: Id<"notificationDispatches">,
	scheduledFunctionId: ScheduledFunctionId,
): Promise<void> {
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

export async function upsertDispatch(
	ctx: MutationCtx,
	args: UpsertDispatchArgs,
): Promise<void> {
	const existing = await ctx.db
		.query("notificationDispatches")
		.withIndex("by_event_user_channel", (q) =>
			q
				.eq("eventId", args.eventId)
				.eq("userId", args.userId)
				.eq("channel", args.channel),
		)
		.first();

	const now = Date.now();
	const attempts = (existing?.attempts ?? 0) + 1;
	const sentAt = args.status === "sent" ? now : existing?.sentAt;
	const digestMode =
		args.digestMode ?? existing?.digestMode ?? DEFAULT_DIGEST_MODE;
	const maxAttempts = existing
		? existing.maxAttempts
		: DEFAULT_DISPATCH_MAX_ATTEMPTS;
	const scheduledFor =
		args.scheduledFor ??
		existing?.scheduledFor ??
		(args.status === "pending" ? now : undefined);
	const digestWindowKey = args.digestWindowKey ?? existing?.digestWindowKey;
	const shouldSchedule = shouldScheduleDispatchProcessing(
		args.status,
		scheduledFor,
	);

	const commonFields = {
		status: args.status,
		digestMode,
		scheduledFor,
		scheduledFunctionId: undefined,
		digestWindowKey,
		reason: args.reason,
		metadataJson: args.metadataJson,
		attempts,
		maxAttempts,
		lastAttemptAt: now,
		sentAt,
		updatedAt: now,
	} as const;

	if (existing) {
		if (existing.scheduledFunctionId) {
			await ctx.scheduler.cancel(existing.scheduledFunctionId);
		}
		await ctx.db.patch("notificationDispatches", existing._id, {
			...commonFields,
			notificationId: args.notificationId ?? existing.notificationId,
		});
		if (shouldSchedule) {
			const scheduledFunctionId = await scheduleDispatchProcessing(
				ctx,
				existing._id,
				scheduledFor,
			);
			await attachDispatchScheduleIfPending(
				ctx,
				existing._id,
				scheduledFunctionId,
			);
		}
		return;
	}

	const dispatchId = await ctx.db.insert("notificationDispatches", {
		...commonFields,
		eventId: args.eventId,
		notificationId: args.notificationId,
		userId: args.userId,
		channel: args.channel,
	});
	if (!shouldSchedule) {
		return;
	}
	const scheduledFunctionId = await scheduleDispatchProcessing(
		ctx,
		dispatchId,
		scheduledFor,
	);
	await attachDispatchScheduleIfPending(ctx, dispatchId, scheduledFunctionId);
}

export async function upsertEnabledExternalDispatches(
	ctx: MutationCtx,
	args: UpsertEnabledExternalDispatchesArgs,
): Promise<void> {
	if (EXTERNAL_NOTIFICATION_CHANNELS.length === 0) {
		return;
	}

	const timezone = await getNotificationUserTimezone(ctx, args.userId);
	const now = Date.now();

	type ExternalDispatchPlan = {
		channel: NotificationChannel;
		digestMode: NotificationDigestMode;
		scheduledFor: number;
		digestWindowKey: string | undefined;
	};

	const channelPlans = await Promise.all(
		EXTERNAL_NOTIFICATION_CHANNELS.map(
			async (channel): Promise<ExternalDispatchPlan | null> => {
				const preference = await getNotificationPreferenceConfig(
					ctx,
					args.userId,
					args.type,
					channel,
				);
				if (!preference.enabled) {
					return null;
				}

				const schedule = computeDispatchSchedule({
					now,
					timezone,
					digestMode: preference.digestMode,
					quietHoursStartMin: preference.quietHoursStartMin,
					quietHoursEndMin: preference.quietHoursEndMin,
				});
				return {
					channel,
					digestMode: preference.digestMode,
					scheduledFor: schedule.scheduledFor,
					digestWindowKey: schedule.digestWindowKey,
				};
			},
		),
	);

	const dispatchPlans = channelPlans.filter(
		(plan): plan is NonNullable<typeof plan> => plan !== null,
	);

	await Promise.all(
		dispatchPlans.map((plan) =>
			upsertDispatch(ctx, {
				eventId: args.eventId,
				userId: args.userId,
				channel: plan.channel,
				status: args.status,
				digestMode: plan.digestMode,
				scheduledFor: plan.scheduledFor,
				...(plan.digestWindowKey
					? { digestWindowKey: plan.digestWindowKey }
					: {}),
				notificationId: args.notificationId,
				metadataJson: args.metadataJson,
				reason: args.reason,
			}),
		),
	);
}

export async function skipRecipient(
	ctx: MutationCtx,
	args: SkipRecipientArgs,
): Promise<void> {
	await upsertDispatch(ctx, {
		eventId: args.eventId,
		userId: args.recipientId,
		channel: IN_APP_CHANNEL,
		status: args.inAppStatus,
		reason: args.reason,
	});
	await upsertEnabledExternalDispatches(ctx, {
		eventId: args.eventId,
		userId: args.recipientId,
		type: args.type,
		status: args.externalStatus,
		metadataJson: args.externalMetadataJson,
		reason: args.externalReason ?? args.reason,
	});
}
