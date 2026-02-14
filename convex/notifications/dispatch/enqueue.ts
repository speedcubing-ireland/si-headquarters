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

	if (existing) {
		if (args.status === "pending") {
			if (existing.status !== "pending") {
				await ctx.db.patch("notificationDispatches", existing._id, {
					notificationId: args.notificationId ?? existing.notificationId,
					metadataJson: args.metadataJson ?? existing.metadataJson,
					updatedAt: now,
				});
				return;
			}

			const digestMode = args.digestMode ?? existing.digestMode;
			const scheduledFor = existing.scheduledFor ?? args.scheduledFor ?? now;
			const digestWindowKey = args.digestWindowKey ?? existing.digestWindowKey;
			const shouldSchedule = shouldScheduleDispatchProcessing(
				existing.status,
				scheduledFor,
			);
			const needsNewSchedule =
				shouldSchedule && existing.scheduledFunctionId === undefined;

			await ctx.db.patch("notificationDispatches", existing._id, {
				digestMode,
				scheduledFor,
				digestWindowKey,
				metadataJson: args.metadataJson ?? existing.metadataJson,
				notificationId: args.notificationId ?? existing.notificationId,
				updatedAt: now,
			});

			if (needsNewSchedule) {
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

		if (existing.scheduledFunctionId) {
			await ctx.scheduler.cancel(existing.scheduledFunctionId);
		}

		const digestMode = args.digestMode ?? existing.digestMode;
		const digestWindowKey = args.digestWindowKey ?? existing.digestWindowKey;
		await ctx.db.patch("notificationDispatches", existing._id, {
			status: args.status,
			digestMode,
			scheduledFor: undefined,
			scheduledFunctionId: undefined,
			digestWindowKey,
			reason: args.reason,
			metadataJson: args.metadataJson ?? existing.metadataJson,
			attempts: existing.attempts,
			maxAttempts: existing.maxAttempts,
			lastAttemptAt: existing.lastAttemptAt,
			sentAt:
				args.status === "sent" ? (existing.sentAt ?? now) : existing.sentAt,
			updatedAt: now,
			notificationId: args.notificationId ?? existing.notificationId,
		});
		return;
	}

	const digestMode = args.digestMode ?? DEFAULT_DIGEST_MODE;
	const maxAttempts = DEFAULT_DISPATCH_MAX_ATTEMPTS;
	const scheduledFor =
		args.scheduledFor ?? (args.status === "pending" ? now : undefined);
	const digestWindowKey = args.digestWindowKey;
	const shouldSchedule = shouldScheduleDispatchProcessing(
		args.status,
		scheduledFor,
	);

	const dispatchId = await ctx.db.insert("notificationDispatches", {
		eventId: args.eventId,
		notificationId: args.notificationId,
		userId: args.userId,
		channel: args.channel,
		status: args.status,
		digestMode,
		scheduledFor,
		scheduledFunctionId: undefined,
		digestWindowKey,
		reason: args.reason,
		metadataJson: args.metadataJson,
		attempts: 0,
		maxAttempts,
		lastAttemptAt: undefined,
		sentAt: args.status === "sent" ? now : undefined,
		updatedAt: now,
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
