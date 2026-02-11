import {
	ConvexError,
	v,
	type ObjectType,
	type PropertyValidators,
} from "convex/values";
import {
	mutation,
	query,
	internalMutation,
	internalAction,
	internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./auth";
import { requireDirector } from "./admin";
import { getCommentParentId } from "./lib/commentParentId";
import {
	notificationChannel,
	notificationDigestMode,
	notificationType,
} from "./lib/validators";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType,
} from "./lib/notificationTemplates";
import { computeDispatchSchedule } from "./lib/notificationScheduling";
import { toISO } from "./lib/transforms";
import { normalizeEmail, validateEmail } from "./lib/sanitize";
import { buildEntityLink, formatEntityTypeLabel } from "./emails/shared";
import {
	IN_APP_CHANNEL,
	EMAIL_CHANNEL,
	EXTERNAL_NOTIFICATION_CHANNELS,
	DEFAULT_DIGEST_MODE,
	EMAIL_DISPATCH_GROUP_CLAIM_TTL_MS,
	notificationReturns,
	notificationPreferenceReturns,
	notificationUserSettingsReturns,
	notificationSettingsReturns,
	notificationSubscriptionReturns,
	notificationDispatchStatsReturns,
	entitySubscriptionArgs,
	type NotificationChannel,
	type NotificationDigestMode,
	type NotificationType,
	type NotificationEntityType,
	type DispatchStatus,
	type ScheduledFunctionId,
	type EntitySubscriptionArg,
	type NotificationEntityRef,
	type NotificationEmitInput,
	type EmailDispatchSnapshot,
	type RecipientDecision,
} from "./lib/notificationTypes";
import {
	docToNotification,
	normalizeListLimit,
	normalizeSubscriptionListLimit,
	isUnreadNotificationVisible,
	listVisibleNotificationsForUser,
	countVisibleUnreadNotifications,
	countDispatchesByStatus,
	serializePayload,
	notificationParentEntityId,
	defaultThreadKey,
} from "./lib/notificationHelpers";
import {
	getResolvedNotificationUserSettings,
	getNotificationUserTimezone,
	upsertNotificationUserSettings,
	getNotificationPreferenceConfig,
	buildPreferenceRowsForUser,
	upsertNotificationPreferenceOverride,
	formatUserSettings,
} from "./lib/notificationSettings";
import {
	canUserAccessTask,
	canUserAccessCompetition,
	canUserAccessComment,
	canUserAccessNotificationEntity,
	getEntitySubscriberIds,
} from "./lib/notificationAccess";
import { getViewSubscriberIds } from "./lib/notificationSubscribers";
import {
	getActorInfo,
	resolveRecipientIds,
	buildTaskNotificationResult,
	buildCompetitionNotificationResult,
	type TaskNotificationBuildArgs,
	type CompetitionNotificationBuildArgs,
} from "./lib/notificationBuilders";
import {
	isDispatchDue,
	buildEmailDispatchGroupClaimKey,
	hasUnexpiredEmailDispatchClaim,
	collectDispatchGroup,
	resolveEmailDispatchItem,
	patchPendingDispatches,
	buildTestEmailData,
	STALE_DISPATCH_THRESHOLD_MS,
	emailDispatchGroupValidator,
	type ResolvedEmailDispatchItem,
} from "./lib/notificationEmail";
import {
	computeDueDateDaysDiff,
	buildDueDateNotificationSpec,
	MS_PER_DAY,
	type DueDateNotificationSpec,
} from "./lib/notificationDueDates";

export { notificationReturns } from "./lib/notificationTypes";

async function upsertEnabledExternalDispatches(
	ctx: MutationCtx,
	args: {
		eventId: Id<"notificationEvents">;
		userId: Id<"users">;
		type: NotificationType;
		status: DispatchStatus;
		notificationId?: Id<"notifications">;
		metadataJson?: string;
		reason?: string;
	},
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

async function upsertDispatch(
	ctx: MutationCtx,
	args: {
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
	},
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

async function ensureNotificationEvent(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entityType: NotificationEntityType;
		entityId: string;
		actorId?: Id<"users">;
		idempotencyKey: string;
		threadKey: string;
		dedupeKey: string;
		payloadJson?: string;
	},
): Promise<Id<"notificationEvents">> {
	const existing = await ctx.db
		.query("notificationEvents")
		.withIndex("by_idempotency_key", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey),
		)
		.first();
	if (existing) {
		return existing._id;
	}

	return ctx.db.insert("notificationEvents", {
		type: args.type,
		entityType: args.entityType,
		entityId: args.entityId,
		actorId: args.actorId,
		idempotencyKey: args.idempotencyKey,
		threadKey: args.threadKey,
		dedupeKey: args.dedupeKey,
		payloadJson: args.payloadJson,
		createdAt: Date.now(),
	});
}

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

async function skipRecipient(
	ctx: MutationCtx,
	opts: {
		eventId: Id<"notificationEvents">;
		recipientId: Id<"users">;
		type: NotificationType;
		inAppStatus: DispatchStatus;
		externalStatus: DispatchStatus;
		reason: string;
		externalReason?: string;
		externalMetadataJson?: string;
	},
): Promise<void> {
	await upsertDispatch(ctx, {
		eventId: opts.eventId,
		userId: opts.recipientId,
		channel: IN_APP_CHANNEL,
		status: opts.inAppStatus,
		reason: opts.reason,
	});
	await upsertEnabledExternalDispatches(ctx, {
		eventId: opts.eventId,
		userId: opts.recipientId,
		type: opts.type,
		status: opts.externalStatus,
		metadataJson: opts.externalMetadataJson,
		reason: opts.externalReason ?? opts.reason,
	});
}

async function decideRecipientHandling(
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

async function emitInAppNotifications(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<Id<"notifications">[]> {
	const recipientSet = new Set<Id<"users">>(input.recipients);
	if (input.includeEntitySubscribers) {
		const subscribers = await getEntitySubscriberIds(ctx, input.entity);
		for (const subscriberId of subscribers) {
			recipientSet.add(subscriberId);
		}
	}
	if (input.includeViewSubscribers ?? true) {
		const viewSubscribers = await getViewSubscriberIds(ctx, input.entity);
		for (const subscriberId of viewSubscribers) {
			recipientSet.add(subscriberId);
		}
	}

	const recipients = [...recipientSet];
	if (recipients.length === 0) {
		return [];
	}

	const entityId = input.entity.entityId;
	const parentEntityId = notificationParentEntityId(input.entity);
	const threadKey = input.threadKey ?? defaultThreadKey(input.entity);
	const suppressActorRecipient = input.suppressActorRecipient ?? true;
	const emailDispatchMetadataJson = JSON.stringify({
		type: input.type,
		title: input.title,
		message: input.message,
		body: input.body,
		entityType: input.entity.entityType,
		entityId,
		parentEntityId,
		priority: input.priority,
		actorName: input.metadata?.actorName,
	} satisfies EmailDispatchSnapshot);

	const inserted: Id<"notifications">[] = [];

	for (const recipientId of recipients) {
		const idempotencyKey = `${input.idempotencyBase}:${recipientId}`;
		const dedupeKey =
			input.dedupeKey ?? `${input.type}:${threadKey}:${recipientId}`;

		const eventId = await ensureNotificationEvent(ctx, {
			type: input.type,
			entityType: input.entity.entityType,
			entityId,
			actorId: input.actorId,
			idempotencyKey,
			threadKey,
			dedupeKey,
			payloadJson: input.payloadJson,
		});

		const decision = await decideRecipientHandling(ctx, {
			input,
			recipientId,
			eventId,
			entityId,
			suppressActorRecipient,
		});

		if (decision.kind === "existing") {
			await upsertDispatch(ctx, {
				eventId,
				userId: recipientId,
				channel: IN_APP_CHANNEL,
				status: "sent",
				notificationId: decision.notification._id,
			});
			await upsertEnabledExternalDispatches(ctx, {
				eventId,
				userId: recipientId,
				type: input.type,
				status: "pending",
				notificationId: decision.notification._id,
				metadataJson: emailDispatchMetadataJson,
			});
			inserted.push(decision.notification._id);
			continue;
		}

		if (decision.kind === "skip") {
			await skipRecipient(ctx, {
				eventId,
				recipientId,
				type: input.type,
				inAppStatus: decision.skip.inAppStatus,
				externalStatus: decision.skip.externalStatus,
				reason: decision.skip.reason,
				externalReason: decision.skip.externalReason,
				externalMetadataJson:
					decision.skip.externalStatus === "pending"
						? emailDispatchMetadataJson
						: undefined,
			});
			continue;
		}

		const { inAppPreference } = decision;
		const now = Date.now();
		const timezone = await getNotificationUserTimezone(ctx, recipientId);
		const inAppSchedule = computeDispatchSchedule({
			now,
			timezone,
			digestMode: inAppPreference.digestMode,
			quietHoursStartMin: inAppPreference.quietHoursStartMin,
			quietHoursEndMin: inAppPreference.quietHoursEndMin,
		});

		const notificationId = await ctx.db.insert("notifications", {
			userId: recipientId,
			type: input.type,
			priority: input.priority,
			status: "unread",
			title: input.title,
			message: input.message,
			body: input.body,
			entityType: input.entity.entityType,
			entityId,
			parentEntityId,
			metadata: input.metadata,
			sourceEventId: eventId,
			threadKey,
			dedupeKey,
			readAt: undefined,
			archivedAt: undefined,
			snoozedUntil: undefined,
			scheduledFor: inAppSchedule.scheduledFor,
			isBatchable: input.isBatchable ?? false,
			batchKey: input.batchKey,
		});
		inserted.push(notificationId);

		await upsertDispatch(ctx, {
			eventId,
			userId: recipientId,
			channel: IN_APP_CHANNEL,
			status: "sent",
			notificationId,
			digestMode: inAppPreference.digestMode,
			scheduledFor: inAppSchedule.scheduledFor,
			digestWindowKey: inAppSchedule.digestWindowKey,
			metadataJson: input.payloadJson,
		});
		await upsertEnabledExternalDispatches(ctx, {
			eventId,
			userId: recipientId,
			type: input.type,
			status: "pending",
			notificationId,
			metadataJson: emailDispatchMetadataJson,
		});
	}

	return inserted;
}

async function ensureSubscriptionEntityAccess(
	ctx: MutationCtx,
	userId: Id<"users">,
	entity: EntitySubscriptionArg,
): Promise<void> {
	if (
		!(await canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(entity),
		))
	) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You do not have access to subscribe to this entity",
		});
	}
}

export const listForUser = query({
	args: {
		limit: v.optional(v.number()),
		nowMs: v.optional(v.number()),
	},
	returns: v.array(notificationReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeListLimit(args.limit);
		void args.nowMs;
		const now = Date.now();
		const docs = await listVisibleNotificationsForUser(ctx, userId, now, limit);
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: { nowMs: v.optional(v.number()) },
	returns: v.number(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		void args.nowMs;
		return countVisibleUnreadNotifications(ctx, userId, Date.now());
	},
});

async function getOwnedNotification(
	ctx: MutationCtx,
	notificationId: Id<"notifications">,
): Promise<Doc<"notifications"> | null> {
	const userId = await requireUserId(ctx);
	const doc = await ctx.db.get("notifications", notificationId);
	return doc && doc.userId === userId ? doc : null;
}

const notificationIdArgs = { notificationId: v.id("notifications") } as const;

export const markRead = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc || doc.status !== "unread") return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "read",
			readAt: Date.now(),
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const markArchived = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc) return null;
		const now = Date.now();
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			readAt: doc.readAt ?? now,
			archivedAt: now,
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const markAllRead = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();

		await Promise.all(
			docs
				.filter((doc) => isUnreadNotificationVisible(doc, now))
				.map((doc) =>
					ctx.db.patch("notifications", doc._id, {
						status: "read",
						readAt: now,
						snoozedUntil: undefined,
					}),
				),
		);
		return null;
	},
});

export const dismiss = markArchived;

export const snooze = mutation({
	args: { notificationId: v.id("notifications"), snoozedUntil: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc || doc.status === "archived") return null;

		const snoozedMs = new Date(args.snoozedUntil).getTime();
		if (!Number.isFinite(snoozedMs) || snoozedMs <= Date.now()) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "snoozedUntil must be a valid future timestamp",
			});
		}

		await ctx.db.patch("notifications", args.notificationId, {
			status: "unread",
			readAt: undefined,
			archivedAt: undefined,
			snoozedUntil: snoozedMs,
		});
		return null;
	},
});

export const unsnooze = mutation({
	args: notificationIdArgs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const doc = await getOwnedNotification(ctx, args.notificationId);
		if (!doc) return null;
		await ctx.db.patch("notifications", args.notificationId, {
			snoozedUntil: undefined,
		});
		return null;
	},
});

export const getUserSettings = query({
	args: {},
	returns: notificationUserSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return formatUserSettings(
			await getResolvedNotificationUserSettings(ctx, userId),
		);
	},
});

export const upsertUserSettings = mutation({
	args: {
		timezone: v.optional(v.string()),
		defaultDigestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
		clearQuietHours: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (
			args.timezone === undefined &&
			args.defaultDigestMode === undefined &&
			args.quietHoursStartMin === undefined &&
			args.quietHoursEndMin === undefined &&
			!args.clearQuietHours
		) {
			return null;
		}
		await upsertNotificationUserSettings(ctx, userId, args);
		return null;
	},
});

export const getSettings = query({
	args: {},
	returns: notificationSettingsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		const preferences = await buildPreferenceRowsForUser(
			ctx,
			userId,
			userSettings,
		);
		return { ...formatUserSettings(userSettings), preferences };
	},
});

export const upsertSettings = mutation({
	args: {
		timezone: v.optional(v.string()),
		defaultDigestMode: v.optional(notificationDigestMode),
		quietHoursStartMin: v.optional(v.number()),
		quietHoursEndMin: v.optional(v.number()),
		clearQuietHours: v.optional(v.boolean()),
		preferences: v.optional(
			v.array(
				v.object({
					type: notificationType,
					channel: notificationChannel,
					enabled: v.optional(v.boolean()),
					digestMode: v.optional(notificationDigestMode),
					respectQuietHours: v.optional(v.boolean()),
					clearOverride: v.optional(v.boolean()),
				}),
			),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const { preferences: prefArgs, ...settingsArgs } = args;
		if (Object.values(settingsArgs).some((v) => v !== undefined)) {
			await upsertNotificationUserSettings(ctx, userId, settingsArgs);
		}

		if (!prefArgs || prefArgs.length === 0) {
			return null;
		}

		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		for (const pref of prefArgs) {
			await upsertNotificationPreferenceOverride(ctx, {
				userId,
				...pref,
				defaultDigestMode: userSettings.defaultDigestMode,
			});
		}
		return null;
	},
});

export const listPreferences = query({
	args: {},
	returns: v.array(notificationPreferenceReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return buildPreferenceRowsForUser(ctx, userId);
	},
});

export const upsertPreference = mutation({
	args: {
		type: notificationType,
		channel: notificationChannel,
		enabled: v.optional(v.boolean()),
		digestMode: v.optional(notificationDigestMode),
		respectQuietHours: v.optional(v.boolean()),
		clearOverride: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const userSettings = await getResolvedNotificationUserSettings(ctx, userId);
		await upsertNotificationPreferenceOverride(ctx, {
			userId,
			...args,
			defaultDigestMode: userSettings.defaultDigestMode,
		});
		return null;
	},
});

type SubscriptionPresentation = {
	label: string;
	description?: string;
	isStale: boolean;
};

const stale = (
	label: string,
	description: string,
): SubscriptionPresentation => ({
	label,
	description,
	isStale: true,
});

async function describeEntitySubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	entityType: string,
	entityId: string,
): Promise<SubscriptionPresentation> {
	if (entityType === "task") {
		const taskId = ctx.db.normalizeId("tasks", entityId);
		if (!taskId) return stale("Deleted task", "Task");
		const task = await ctx.db.get("tasks", taskId);
		if (!task) return stale("Deleted task", "Task");
		if (!(await canUserAccessTask(ctx, userId, taskId)))
			return stale("Restricted task", "Task");
		return {
			label: `${task.identifier}: ${task.title}`,
			description: "Task",
			isStale: false,
		};
	}

	if (entityType === "competition") {
		const compId = ctx.db.normalizeId("competitions", entityId);
		if (!compId) return stale("Deleted competition", "Competition");
		const comp = await ctx.db.get("competitions", compId);
		if (!comp) return stale("Deleted competition", "Competition");
		if (!(await canUserAccessCompetition(ctx, userId, compId)))
			return stale("Restricted competition", "Competition");
		return { label: comp.name, description: "Competition", isStale: false };
	}

	const commentId = ctx.db.normalizeId("comments", entityId);
	if (!commentId) return stale("Deleted comment", "Comment");
	const comment = await ctx.db.get("comments", commentId);
	if (!comment) return stale("Deleted comment", "Comment");
	if (!(await canUserAccessComment(ctx, userId, commentId)))
		return stale("Restricted comment", "Comment");

	if (comment.parentType === "task") {
		const task = await ctx.db.get(
			"tasks",
			getCommentParentId("task", comment.parentId),
		);
		return task
			? {
					label: `Comment on ${task.identifier}`,
					description: "Task comment",
					isStale: false,
				}
			: stale("Comment on deleted task", "Task comment");
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", comment.parentId),
	);
	if (!update)
		return stale("Comment on deleted update", "Competition update comment");
	const competition = await ctx.db.get("competitions", update.competitionId);
	return {
		label: competition
			? `Comment on ${competition.name}`
			: "Comment on competition update",
		description: "Competition update comment",
		isStale: competition === null,
	};
}

async function describeSubscription(
	ctx: QueryCtx,
	userId: Id<"users">,
	subscription: Doc<"notificationSubscriptions">,
): Promise<SubscriptionPresentation> {
	if (subscription.subscriptionType === "view") {
		if (!subscription.viewId) return stale("Deleted view", "Saved view");
		const view = await ctx.db.get("savedViews", subscription.viewId);
		if (!view || view.userId !== userId)
			return stale("Deleted view", "Saved view");
		return {
			label: view.name,
			description:
				view.entity === "tasks"
					? `Task view (${view.pageId})`
					: `Competition view (${view.pageId})`,
			isStale: false,
		};
	}

	if (!subscription.entityType || !subscription.entityId) {
		return stale("Invalid subscription", "Entity");
	}

	return describeEntitySubscription(
		ctx,
		userId,
		subscription.entityType,
		subscription.entityId,
	);
}

export const listSubscriptions = query({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.array(notificationSubscriptionReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeSubscriptionListLimit(args.limit);
		const docs = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_updated_at", (q) => q.eq("userId", userId))
			.order("desc")
			.take(limit);

		const rows = await Promise.all(
			docs.map(async (doc) => {
				const presentation = await describeSubscription(ctx, userId, doc);
				return {
					id: doc._id,
					subscriptionType: doc.subscriptionType,
					entityType: doc.entityType,
					entityId: doc.entityId,
					viewId: doc.viewId,
					viewEntity: doc.viewEntity,
					label: presentation.label,
					description: presentation.description,
					isStale: presentation.isStale,
					updatedAt: toISO(doc.updatedAt),
				};
			}),
		);
		return rows;
	},
});

function findUserEntitySubscription(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
	entityType: "task" | "competition" | "comment",
	entityId: string,
) {
	return ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_user_entity", (q) =>
			q
				.eq("userId", userId)
				.eq("entityType", entityType)
				.eq("entityId", entityId),
		)
		.first();
}

function findUserViewSubscription(
	ctx: Pick<QueryCtx, "db">,
	userId: Id<"users">,
	viewId: Id<"savedViews">,
) {
	return ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_user_view", (q) =>
			q.eq("userId", userId).eq("viewId", viewId),
		)
		.first();
}

function entityRefFromSubscriptionArg(
	entity: EntitySubscriptionArg,
): NotificationEntityRef {
	return entity.entityType === "comment"
		? { entityType: "comment", entityId: entity.entityId }
		: entity;
}

export const isSubscribedToEntity = query({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (!existing) return false;
		return canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(args.entity),
		);
	},
});

export const isSubscribedToView = query({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const view = await ctx.db.get("savedViews", args.viewId);
		if (!view || view.userId !== userId) return false;
		return (await findUserViewSubscription(ctx, userId, args.viewId)) !== null;
	},
});

export const subscribeToEntity = mutation({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.id("notificationSubscriptions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await ensureSubscriptionEntityAccess(ctx, userId, args.entity);

		const entityId = `${args.entity.entityId}`;
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			entityId,
		);
		if (existing) return existing._id;

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			subscriptionType: "entity",
			entityType: args.entity.entityType,
			entityId,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromEntity = mutation({
	args: {
		entity: entitySubscriptionArgs,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (existing)
			await ctx.db.delete("notificationSubscriptions", existing._id);
		return null;
	},
});

export const subscribeToView = mutation({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.id("notificationSubscriptions"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const view = await ctx.db.get("savedViews", args.viewId);
		if (!view || view.userId !== userId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to this view",
			});
		}

		const existing = await findUserViewSubscription(ctx, userId, args.viewId);
		if (existing) {
			if (existing.viewEntity !== view.entity) {
				await ctx.db.patch("notificationSubscriptions", existing._id, {
					viewEntity: view.entity,
					updatedAt: Date.now(),
				});
			}
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			subscriptionType: "view",
			viewId: args.viewId,
			viewEntity: view.entity,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromView = mutation({
	args: {
		viewId: v.id("savedViews"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserViewSubscription(ctx, userId, args.viewId);
		if (existing)
			await ctx.db.delete("notificationSubscriptions", existing._id);
		return null;
	},
});

export const unsubscribe = mutation({
	args: {
		subscriptionId: v.id("notificationSubscriptions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await ctx.db.get(
			"notificationSubscriptions",
			args.subscriptionId,
		);
		if (!existing || existing.userId !== userId) {
			return null;
		}
		await ctx.db.delete("notificationSubscriptions", args.subscriptionId);
		return null;
	},
});

const DISPATCH_STATUSES = ["pending", "sent", "skipped", "failed"] as const;

export const getDispatchStats = query({
	args: {},
	returns: notificationDispatchStatsReturns,
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const counts = await Promise.all(
			DISPATCH_STATUSES.map((s) => countDispatchesByStatus(ctx, userId, s)),
		);
		return Object.fromEntries(
			DISPATCH_STATUSES.map((s, i) => [s, counts[i]]),
		) as Record<(typeof DISPATCH_STATUSES)[number], number>;
	},
});

export const sendTestDigestSeries = mutation({
	args: {
		toEmail: v.optional(v.string()),
	},
	returns: v.object({
		toEmail: v.string(),
		queued: v.boolean(),
		emailCount: v.number(),
	}),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const userId = await requireUserId(ctx);
		const user = await ctx.db.get("users", userId);

		const fallbackEmail = normalizeEmail(user?.email);
		const toEmail = normalizeEmail(args.toEmail ?? fallbackEmail);
		if (!toEmail || !validateEmail(toEmail)) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Enter a valid recipient email for test digest sends.",
			});
		}

		const actorName = user?.name ?? "Test User";
		for (const type of ["immediate", "hourly", "three_daily"] as const) {
			await ctx.scheduler.runAfter(0, internal.notifications._sendTestEmail, {
				type,
				toEmail,
				recipientName: user?.name,
				actorName,
			});
		}

		return {
			toEmail,
			queued: true,
			emailCount: 3,
		};
	},
});

async function emitFromConfig(
	ctx: MutationCtx,
	config: NotificationTemplateConfig,
	opts: Omit<
		NotificationEmitInput,
		| "title"
		| "message"
		| "priority"
		| "metadata"
		| "body"
		| "isBatchable"
		| "batchKey"
	>,
): Promise<Id<"notifications"> | null> {
	const inserted = await emitInAppNotifications(ctx, {
		...opts,
		title: config.title,
		message: config.message,
		priority: config.priority,
		metadata: config.metadata,
		body: config.body,
		isBatchable: config.isBatchable,
		batchKey: config.batchKey,
	});
	return inserted[0] ?? null;
}

async function createTaskNotification(
	ctx: MutationCtx,
	type: TaskNotificationType,
	args: TaskNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) return null;

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const result = await buildTaskNotificationResult(
		ctx,
		type,
		task,
		actor,
		args,
		{ type, taskId: task._id, eventKey },
	);
	if (!result) return null;

	const isTargeted = type === "task_mentioned" || type === "comment_replied";
	return emitFromConfig(ctx, result.config, {
		type,
		entity: result.entity,
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${type}:${task._id}:${task.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		includeEntitySubscribers: !isTargeted,
		includeViewSubscribers: !isTargeted,
	});
}

async function createCompetitionNotification(
	ctx: MutationCtx,
	args: CompetitionNotificationBuildArgs,
): Promise<Id<"notifications"> | null> {
	const competition = await ctx.db.get("competitions", args.competitionId);
	if (!competition) return null;

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const result = buildCompetitionNotificationResult(competition, actor, args, {
		type: args.type,
		competitionId: args.competitionId,
		eventKey,
	});
	if (!result) return null;

	return emitFromConfig(ctx, result.config, {
		type: args.type,
		entity: { entityType: "competition", entityId: competition._id },
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${args.type}:${competition._id}:${competition.updatedAt}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		includeEntitySubscribers: true,
	});
}

async function createReminderNotification(
	ctx: MutationCtx,
	args: {
		reminderId: Id<"reminders">;
		userId: Id<"users">;
		taskId: Id<"tasks">;
		message?: string;
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const reminder = await ctx.db.get("reminders", args.reminderId);
	if (!reminder) return null;

	const task = await ctx.db.get("tasks", args.taskId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	return emitFromConfig(
		ctx,
		NotificationTemplates.reminder_triggered(task ?? args.taskId, args.message),
		{
			type: "reminder_triggered",
			entity: {
				entityType: "reminder",
				entityId: reminder._id,
				parentTaskId: args.taskId,
			},
			recipients: [args.userId],
			idempotencyBase: `reminder_triggered:${reminder._id}:${eventKey}`,
			payloadJson: serializePayload({
				reminderId: reminder._id,
				taskId: args.taskId,
				eventKey,
			}),
			includeEntitySubscribers: false,
			includeViewSubscribers: false,
			suppressActorRecipient: false,
		},
	);
}

function taskNotifyMutation<T extends PropertyValidators>(
	args: T,
	type: TaskNotificationType,
	mapArgs: (a: ObjectType<T>) => TaskNotificationBuildArgs,
) {
	return internalMutation({
		args,
		returns: v.union(v.id("notifications"), v.null()),
		handler: async (ctx: MutationCtx, a: ObjectType<T>) =>
			createTaskNotification(ctx, type, mapArgs(a)),
	});
}

const assigneeArgs = {
	taskId: v.id("tasks"),
	assigneeId: v.id("users"),
	actorId: v.id("users"),
	eventKey: v.optional(v.string()),
} as const;

const assigneeMapper = (
	a: ObjectType<typeof assigneeArgs>,
): TaskNotificationBuildArgs => ({
	taskId: a.taskId,
	recipientId: a.assigneeId,
	actorId: a.actorId,
	eventKey: a.eventKey,
});

export const _notifyTaskAssigned = taskNotifyMutation(
	assigneeArgs,
	"task_assigned",
	assigneeMapper,
);

export const _notifyTaskUnassigned = taskNotifyMutation(
	assigneeArgs,
	"task_unassigned",
	assigneeMapper,
);

const mentionArgs = {
	taskId: v.id("tasks"),
	commentId: v.id("comments"),
	mentionedUserId: v.id("users"),
	actorId: v.id("users"),
	eventKey: v.optional(v.string()),
} as const;

export const _notifyTaskMentioned = taskNotifyMutation(
	mentionArgs,
	"task_mentioned",
	(a: ObjectType<typeof mentionArgs>): TaskNotificationBuildArgs => ({
		taskId: a.taskId,
		commentId: a.commentId,
		recipientId: a.mentionedUserId,
		actorId: a.actorId,
		eventKey: a.eventKey,
	}),
);

const commentArgs = {
	taskId: v.id("tasks"),
	commentId: v.id("comments"),
	recipientIds: v.optional(v.array(v.id("users"))),
	actorId: v.id("users"),
	eventKey: v.optional(v.string()),
} as const;

export const _notifyCommentAdded = taskNotifyMutation(
	commentArgs,
	"comment_added",
	(a): TaskNotificationBuildArgs => a,
);
export const _notifyCommentReplied = taskNotifyMutation(
	commentArgs,
	"comment_replied",
	(a): TaskNotificationBuildArgs => a,
);

const multiRecipientTaskArgs = {
	taskId: v.id("tasks"),
	recipientId: v.optional(v.id("users")),
	recipientIds: v.optional(v.array(v.id("users"))),
	actorId: v.id("users"),
	eventKey: v.optional(v.string()),
} as const;

export const _notifyTaskStatusChanged = taskNotifyMutation(
	{ ...multiRecipientTaskArgs, oldStatus: v.string(), newStatus: v.string() },
	"task_status_changed",
	(a): TaskNotificationBuildArgs => a,
);

export const _notifyTaskPriorityChanged = taskNotifyMutation(
	{
		...multiRecipientTaskArgs,
		oldPriority: v.string(),
		newPriority: v.string(),
	},
	"task_priority_changed",
	(a): TaskNotificationBuildArgs => a,
);

export const _notifyTaskAwaitingReview = taskNotifyMutation(
	multiRecipientTaskArgs,
	"task_awaiting_review",
	(a): TaskNotificationBuildArgs => a,
);

const relationArgs = {
	blockedTaskId: v.id("tasks"),
	blockingTaskId: v.id("tasks"),
	recipientId: v.optional(v.id("users")),
	recipientIds: v.optional(v.array(v.id("users"))),
	actorId: v.id("users"),
	eventKey: v.optional(v.string()),
} as const;

const relationMapper = (
	a: ObjectType<typeof relationArgs>,
): TaskNotificationBuildArgs => ({
	taskId: a.blockedTaskId,
	blockingTaskId: a.blockingTaskId,
	recipientId: a.recipientId,
	recipientIds: a.recipientIds,
	actorId: a.actorId,
	eventKey: a.eventKey,
});

export const _notifyTaskRelationBlocked = taskNotifyMutation(
	relationArgs,
	"relation_blocked",
	relationMapper,
);

export const _notifyTaskRelationUnblocked = taskNotifyMutation(
	relationArgs,
	"relation_unblocked",
	relationMapper,
);

export const _notifyTaskApproved = taskNotifyMutation(
	multiRecipientTaskArgs,
	"task_approved",
	(a): TaskNotificationBuildArgs => a,
);
export const _notifyTaskUnapproved = taskNotifyMutation(
	multiRecipientTaskArgs,
	"task_unapproved",
	(a): TaskNotificationBuildArgs => a,
);

export const _notifyDueDateChanged = taskNotifyMutation(
	{
		...multiRecipientTaskArgs,
		oldDueDate: v.optional(v.string()),
		newDueDate: v.optional(v.string()),
	},
	"due_date_changed",
	(a): TaskNotificationBuildArgs => a,
);

async function emitDueDateUrgencyNotification(
	ctx: MutationCtx,
	type: "due_date_approaching" | "due_date_overdue",
	args: {
		taskId: Id<"tasks">;
		assigneeId: Id<"users">;
		days: number;
		eventKey?: string;
	},
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task?.dueDate) return null;

	const config =
		type === "due_date_approaching"
			? NotificationTemplates.due_date_approaching(task, args.days)
			: NotificationTemplates.due_date_overdue(task, args.days);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	return emitFromConfig(ctx, config, {
		type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [args.assigneeId],
		idempotencyBase: `${type}:${task._id}:${args.days}:${eventKey}`,
		payloadJson: serializePayload({
			taskId: task._id,
			...(type === "due_date_approaching"
				? { daysUntil: args.days }
				: { daysOverdue: args.days }),
			eventKey,
		}),
		includeEntitySubscribers: true,
	});
}

export const _notifyDueDateApproaching = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysUntil: v.number(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		emitDueDateUrgencyNotification(ctx, "due_date_approaching", {
			taskId: args.taskId,
			assigneeId: args.assigneeId,
			days: args.daysUntil,
			eventKey: args.eventKey,
		}),
});

export const _notifyDueDateOverdue = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysOverdue: v.number(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		emitDueDateUrgencyNotification(ctx, "due_date_overdue", {
			taskId: args.taskId,
			assigneeId: args.assigneeId,
			days: args.daysOverdue,
			eventKey: args.eventKey,
		}),
});

export const _notifyCompetitionPhaseChanged = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		oldPhaseName: v.string(),
		newPhaseName: v.string(),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createCompetitionNotification(ctx, {
			type: "competition_phase_changed",
			...args,
		}),
});

export const _notifyProgressUpdateAdded = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.optional(v.id("users")),
		recipientIds: v.optional(v.array(v.id("users"))),
		actorId: v.id("users"),
		competitionName: v.string(),
		status: v.union(
			v.literal("on-track"),
			v.literal("at-risk"),
			v.literal("off-track"),
		),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createCompetitionNotification(ctx, {
			type: "progress_update_added",
			...args,
		}),
});

export const _notifyReminderTriggered = internalMutation({
	args: {
		reminderId: v.id("reminders"),
		userId: v.id("users"),
		taskId: v.id("tasks"),
		message: v.optional(v.string()),
		eventKey: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => createReminderNotification(ctx, args),
});

export const _processDispatch = internalMutation({
	args: {
		dispatchId: v.id("notificationDispatches"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const seedDispatch = await ctx.db.get(
			"notificationDispatches",
			args.dispatchId,
		);
		if (
			!seedDispatch ||
			seedDispatch.status !== "pending" ||
			!isDispatchDue(seedDispatch, now)
		) {
			return 0;
		}

		const dispatchGroup = await collectDispatchGroup(ctx, seedDispatch);
		if (dispatchGroup.length === 0) {
			return 0;
		}

		const dueDispatches: Doc<"notificationDispatches">[] = [];
		for (const dispatch of dispatchGroup) {
			const latest = await ctx.db.get("notificationDispatches", dispatch._id);
			if (
				!latest ||
				latest.status !== "pending" ||
				!isDispatchDue(latest, now)
			) {
				continue;
			}
			if (
				seedDispatch.channel === EMAIL_CHANNEL &&
				hasUnexpiredEmailDispatchClaim(latest, now)
			) {
				continue;
			}
			dueDispatches.push(latest);
		}
		if (dueDispatches.length === 0) {
			return 0;
		}

		const eventIds = [
			...new Set(dueDispatches.map((dispatch) => dispatch.eventId)),
		];
		const metadataJson = JSON.stringify({
			mode: seedDispatch.digestMode,
			channel: seedDispatch.channel,
			eventCount: eventIds.length,
			eventIds,
			digestWindowKey: seedDispatch.digestWindowKey,
			processedAt: now,
		});

		if (seedDispatch.channel === EMAIL_CHANNEL) {
			const claimKey = buildEmailDispatchGroupClaimKey(now, seedDispatch._id);
			for (const dispatch of dueDispatches) {
				await ctx.db.patch("notificationDispatches", dispatch._id, {
					reason: claimKey,
					lastAttemptAt: now,
					updatedAt: now,
				});
			}
			await ctx.scheduler.runAfter(
				0,
				internal.notifications._sendEmailDispatchGroup,
				{
					dispatchIds: dueDispatches.map((dispatch) => dispatch._id),
					claimKey,
				},
			);
			const recoveryScheduledFunctionId = await ctx.scheduler.runAfter(
				EMAIL_DISPATCH_GROUP_CLAIM_TTL_MS,
				internal.notifications._processDispatch,
				{ dispatchId: seedDispatch._id },
			);
			for (const dispatch of dueDispatches) {
				await ctx.db.patch("notificationDispatches", dispatch._id, {
					scheduledFunctionId: recoveryScheduledFunctionId,
					updatedAt: now,
				});
			}
			return dueDispatches.length;
		}

		for (const dispatch of dueDispatches) {
			await ctx.db.patch("notificationDispatches", dispatch._id, {
				status: "skipped",
				reason: "channel_not_implemented",
				metadataJson,
				attempts: dispatch.attempts + 1,
				lastAttemptAt: now,
				scheduledFunctionId: undefined,
				updatedAt: now,
			});
		}

		return dueDispatches.length;
	},
});

export const _getDispatchGroupForEmail = internalQuery({
	args: {
		dispatchIds: v.array(v.id("notificationDispatches")),
		claimKey: v.optional(v.string()),
	},
	returns: v.union(v.null(), emailDispatchGroupValidator),
	handler: async (ctx, args) => {
		if (args.dispatchIds.length === 0) {
			return null;
		}

		const dispatchDocs = (
			await Promise.all(
				args.dispatchIds.map((dispatchId) =>
					ctx.db.get("notificationDispatches", dispatchId),
				),
			)
		).filter((dispatch): dispatch is Doc<"notificationDispatches"> =>
			Boolean(
				dispatch &&
					dispatch.status === "pending" &&
					dispatch.channel === EMAIL_CHANNEL &&
					(args.claimKey === undefined || dispatch.reason === args.claimKey),
			),
		);

		if (dispatchDocs.length === 0) {
			return null;
		}

		const seed = dispatchDocs[0];
		if (!seed) {
			return null;
		}

		const groupedDispatches = dispatchDocs.filter(
			(dispatch) =>
				dispatch.userId === seed.userId &&
				dispatch.digestMode === seed.digestMode &&
				dispatch.digestWindowKey === seed.digestWindowKey,
		);
		if (groupedDispatches.length === 0) {
			return null;
		}

		const user = await ctx.db.get("users", seed.userId);
		if (!user?.email) {
			return null;
		}

		const resolvedItems = await Promise.all(
			groupedDispatches.map((dispatch) =>
				resolveEmailDispatchItem(ctx, dispatch),
			),
		);
		const items = resolvedItems
			.filter((item): item is ResolvedEmailDispatchItem => item !== null)
			.sort((a, b) => a.sortTime - b.sortTime)
			.map(({ sortTime: _, ...rest }) => rest);

		if (items.length === 0) {
			return null;
		}

		return {
			dispatchIds: items.map((item) => item.dispatchId),
			digestMode: seed.digestMode,
			digestWindowKey: seed.digestWindowKey,
			recipientEmail: user.email,
			recipientName: user.name,
			items,
		};
	},
});

export const _sendEmailDispatchGroup = internalAction({
	args: {
		dispatchIds: v.array(v.id("notificationDispatches")),
		claimKey: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.dispatchIds.length === 0) {
			return null;
		}

		const payload = await ctx.runQuery(
			internal.notifications._getDispatchGroupForEmail,
			{
				dispatchIds: args.dispatchIds,
				claimKey: args.claimKey,
			},
		);
		if (!payload) {
			await ctx.runMutation(internal.notifications._markDispatchesFailed, {
				dispatchIds: args.dispatchIds,
				reason: "email_dispatch_payload_unavailable",
				claimKey: args.claimKey,
			});
			return null;
		}

		const { sendEmail } = await import("./lib/email");
		const {
			buildNotificationDigestEmailHtml,
			buildNotificationDigestEmailPlainText,
			buildNotificationDigestEmailSubject,
			buildNotificationEmailHtml,
			buildNotificationEmailPlainText,
			buildNotificationEmailSubject,
		} = await import("./lib/emailTemplates");

		const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
		const firstItem = payload.items[0];
		if (!firstItem) {
			await ctx.runMutation(internal.notifications._markDispatchesFailed, {
				dispatchIds: payload.dispatchIds,
				reason: "email_dispatch_payload_empty",
				claimKey: args.claimKey,
			});
			return null;
		}

		const to = [
			{ address: payload.recipientEmail, displayName: payload.recipientName },
		];

		try {
			if (payload.digestMode === "immediate") {
				const { dispatchId: _, type: itemType, ...emailItemData } = firstItem;
				const emailContent = { ...emailItemData, appUrl };
				await sendEmail({
					to,
					subject: buildNotificationEmailSubject(itemType, firstItem.title),
					html: await buildNotificationEmailHtml(emailContent),
					plainText: await buildNotificationEmailPlainText(emailContent),
				});
			} else {
				const digestItems = payload.items.map(
					(item: (typeof payload.items)[number]) => ({
						title: item.title,
						message: item.message,
						entityType: formatEntityTypeLabel(item.entityType),
						priority: item.priority,
						actorName: item.actorName,
						link: buildEntityLink(appUrl, item),
					}),
				);
				const digestOpts = {
					mode: payload.digestMode,
					appUrl,
					items: digestItems,
				};
				await sendEmail({
					to,
					subject: buildNotificationDigestEmailSubject(
						payload.digestMode,
						payload.items.length,
					),
					html: await buildNotificationDigestEmailHtml(digestOpts),
					plainText: await buildNotificationDigestEmailPlainText(digestOpts),
				});
			}

			await ctx.runMutation(internal.notifications._markDispatchesSent, {
				dispatchIds: payload.dispatchIds,
				claimKey: args.claimKey,
			});
		} catch (error) {
			const reason =
				error instanceof Error ? error.message : "Unknown email send error";
			await ctx.runMutation(internal.notifications._markDispatchesFailed, {
				dispatchIds: payload.dispatchIds,
				reason,
				claimKey: args.claimKey,
			});
		}

		return null;
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
	handler: async (_ctx, args) => {
		const { sendEmail } = await import("./lib/email");
		const {
			buildNotificationEmailHtml,
			buildNotificationEmailPlainText,
			buildNotificationEmailSubject,
			buildNotificationDigestEmailHtml,
			buildNotificationDigestEmailPlainText,
			buildNotificationDigestEmailSubject,
		} = await import("./lib/emailTemplates");

		const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
		const testData = buildTestEmailData(appUrl, args.actorName);
		const to = [
			{
				address: args.toEmail,
				displayName: args.recipientName,
			},
		];

		if (args.type === "immediate") {
			const item = testData.immediate;
			await sendEmail({
				to,
				subject: `[HQ TEST] ${buildNotificationEmailSubject("task_assigned", item.title)}`,
				html: await buildNotificationEmailHtml({ ...item, appUrl }),
				plainText: await buildNotificationEmailPlainText({ ...item, appUrl }),
			});
		} else {
			const mode =
				args.type === "hourly" ? ("hourly" as const) : ("three_daily" as const);
			const items =
				args.type === "hourly" ? testData.hourly : testData.threeDaily;
			await sendEmail({
				to,
				subject: `[HQ TEST] ${buildNotificationDigestEmailSubject(mode, items.length)}`,
				html: await buildNotificationDigestEmailHtml({ mode, appUrl, items }),
				plainText: await buildNotificationDigestEmailPlainText({
					mode,
					appUrl,
					items,
				}),
			});
		}

		return null;
	},
});

export const _markDispatchesSent = internalMutation({
	args: {
		dispatchIds: v.array(v.id("notificationDispatches")),
		claimKey: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await patchPendingDispatches(
			ctx,
			args.dispatchIds,
			"sent",
			undefined,
			args.claimKey,
		);
		return null;
	},
});

export const _markDispatchesFailed = internalMutation({
	args: {
		dispatchIds: v.array(v.id("notificationDispatches")),
		reason: v.string(),
		claimKey: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await patchPendingDispatches(
			ctx,
			args.dispatchIds,
			"failed",
			args.reason,
			args.claimKey,
		);
		return null;
	},
});

async function emitDueDateNotification(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	recipientId: Id<"users">,
	spec: DueDateNotificationSpec,
): Promise<number> {
	const result = await emitFromConfig(ctx, spec.config, {
		type: spec.type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [recipientId],
		idempotencyBase: spec.idempotencyBase,
		payloadJson: serializePayload(spec.payload),
		includeEntitySubscribers: true,
	});
	return result ? 1 : 0;
}

async function maybeEmitDueDateNotificationForTask(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	now: number,
): Promise<number> {
	if (
		!task.dueDate ||
		!task.assigneeId ||
		task.status === "done" ||
		task.status === "cancelled"
	) {
		return 0;
	}

	const daysDiff = computeDueDateDaysDiff(task.dueDate, now);
	const dayBucket = Math.floor(now / MS_PER_DAY);
	const spec = buildDueDateNotificationSpec(task, daysDiff, dayBucket);
	if (!spec) {
		return 0;
	}

	return emitDueDateNotification(ctx, task, task.assigneeId, spec);
}

export const _checkDueDates = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_archived", (q) => q.eq("archived", false))
			.collect();
		let notificationCount = 0;

		for (const task of tasks) {
			notificationCount += await maybeEmitDueDateNotificationForTask(
				ctx,
				task,
				now,
			);
		}

		return notificationCount;
	},
});

export const _checkDueDateForTask = internalMutation({
	args: {
		taskId: v.id("tasks"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) {
			return 0;
		}
		return maybeEmitDueDateNotificationForTask(ctx, task, Date.now());
	},
});

export const _sweepStaleDispatches = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		let rescheduled = 0;

		for (const channel of EXTERNAL_NOTIFICATION_CHANNELS) {
			const pendingDispatches = await ctx.db
				.query("notificationDispatches")
				.withIndex("by_channel_status", (q) =>
					q.eq("channel", channel).eq("status", "pending"),
				)
				.collect();

			for (const dispatch of pendingDispatches) {
				if (
					dispatch.scheduledFor !== undefined &&
					dispatch.scheduledFor + STALE_DISPATCH_THRESHOLD_MS < now
				) {
					await ctx.scheduler.runAfter(
						0,
						internal.notifications._processDispatch,
						{ dispatchId: dispatch._id },
					);
					rescheduled += 1;
				}
			}
		}

		return rescheduled;
	},
});
