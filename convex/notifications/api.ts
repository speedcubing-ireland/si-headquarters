import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUserId } from "../core/auth";
import { resolveHqSiteBaseUrl } from "../lib/siteUrls";
import { getCommentParentId } from "../lib/commentParentId";
import { toISO } from "../lib/transforms";
import { buildNotificationEmitInput } from "./emit";
import {
	buildCompetitionNotificationResult,
	buildTaskNotificationResult,
	getActorInfo,
	resolveRecipientIds,
	type CompetitionNotificationBuildArgs,
	type TaskNotificationBuildArgs,
} from "./lib/notificationBuilders";
import {
	canUserAccessComment,
	canUserAccessCompetition,
	canUserAccessNotificationEntity,
	canUserAccessTask,
} from "./lib/notificationAccess";
import {
	buildDueDateNotificationSpec,
	computeDueDateDaysDiff,
	MS_PER_DAY,
	type DueDateNotificationSpec,
} from "./lib/notificationDueDates";
import {
	DEFAULT_SUBSCRIPTION_LIST_LIMIT,
	MAX_SUBSCRIPTION_LIST_LIMIT,
	entitySubscriptionArgs,
	type EntitySubscriptionArg,
	type NotificationEmitInput,
	type NotificationEntityRef,
	type NotificationType,
	notificationSubscriptionReturns,
} from "./lib/notificationTypes";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType as TemplateTaskNotificationType,
} from "./lib/notificationTemplates";
import { CHANNEL_SCOPED_NOTIFICATION_TYPES } from "./lib/validators";
import { expandRecipientIds } from "./recipients/expand";
import { HQ_ACTION_TOKEN_PREFIX } from "../discord/interactions";

const DISCORD_CHANNEL_NOTIFICATION_TYPES = new Set<NotificationType>(
	CHANNEL_SCOPED_NOTIFICATION_TYPES,
);

type DiscordActionButtonSpec = {
	customId: string;
	label: string;
	style: 1 | 2 | 3 | 4 | 5;
	url?: string;
};

type DiscordMessagePayload = {
	title: string;
	message: string;
	url?: string;
	actions: DiscordActionButtonSpec[];
	priority?: "urgent" | "high" | "normal";
};

type SubscriptionPresentation = {
	label: string;
	description?: string;
	isStale: boolean;
};

type TaskEventType = TemplateTaskNotificationType;

type BaseTaskEventArgs = {
	taskId: Id<"tasks">;
	actorId: Id<"users">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	eventKey?: string;
};

type EmitNotificationEventArgs =
	| ({ type: "task_assigned" | "task_unassigned" } & BaseTaskEventArgs)
	| ({
			type: "task_mentioned" | "comment_added" | "comment_replied";
			commentId: Id<"comments">;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_status_changed";
			oldStatus: string;
			newStatus: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_priority_changed";
			oldPriority: string;
			newPriority: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "task_awaiting_review" | "task_approved" | "task_unapproved";
	  } & BaseTaskEventArgs)
	| ({
			type: "due_date_changed";
			oldDueDate?: string;
			newDueDate?: string;
	  } & BaseTaskEventArgs)
	| ({
			type: "relation_blocked" | "relation_unblocked";
			blockingTaskId: Id<"tasks">;
	  } & BaseTaskEventArgs)
	| {
			type: "due_date_approaching";
			taskId: Id<"tasks">;
			assigneeId: Id<"users">;
			daysUntil: number;
			eventKey?: string;
	  }
	| {
			type: "due_date_overdue";
			taskId: Id<"tasks">;
			assigneeId: Id<"users">;
			daysOverdue: number;
			eventKey?: string;
	  }
	| {
			type: "competition_phase_changed";
			competitionId: Id<"competitions">;
			recipientId?: Id<"users">;
			recipientIds?: Id<"users">[];
			actorId: Id<"users">;
			oldPhaseName: string;
			newPhaseName: string;
			eventKey?: string;
	  }
	| {
			type: "progress_update_added";
			competitionId: Id<"competitions">;
			updateId: Id<"competitionUpdates">;
			recipientId?: Id<"users">;
			recipientIds?: Id<"users">[];
			actorId: Id<"users">;
			competitionName: string;
			status: "on-track" | "at-risk" | "off-track";
			eventKey?: string;
	  }
	| {
			type: "reminder_triggered";
			reminderId: Id<"reminders">;
			userId: Id<"users">;
			taskId: Id<"tasks">;
			message?: string;
			eventKey?: string;
	  };

function normalizeSubscriptionListLimit(limit: number | undefined): number {
	return Math.max(
		1,
		Math.min(
			limit ?? DEFAULT_SUBSCRIPTION_LIST_LIMIT,
			MAX_SUBSCRIPTION_LIST_LIMIT,
		),
	);
}

function serializePayload(
	payload: Record<string, string | number | boolean | null | undefined>,
): string {
	return JSON.stringify(payload);
}

function parsePayloadJson(
	payloadJson: string | undefined,
): Record<string, string | number | boolean | null | undefined> {
	if (!payloadJson) {
		return {};
	}
	try {
		const value = JSON.parse(payloadJson);
		return typeof value === "object" && value !== null ? value : {};
	} catch {
		return {};
	}
}

function buildDiscordNotificationUrl(
	entity: NotificationEntityRef,
): string | undefined {
	const baseUrl = resolveHqSiteBaseUrl();
	switch (entity.entityType) {
		case "task":
			return `${baseUrl}/tasks/${entity.entityId}`;
		case "competition":
			return `${baseUrl}/competitions/${entity.entityId}`;
		case "comment":
		case "reminder":
			return entity.parentTaskId
				? `${baseUrl}/tasks/${entity.parentTaskId}`
				: undefined;
	}
}

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

async function insertDiscordActionToken(
	ctx: MutationCtx,
	args: {
		actionKind: Doc<"discordActionTokens">["actionKind"];
		userId?: Id<"users">;
		taskId?: Id<"tasks">;
		commentId?: Id<"comments">;
		updateId?: Id<"competitionUpdates">;
		reminderId?: Id<"reminders">;
		status?: Doc<"discordActionTokens">["status"];
		messageId?: string;
		channelId?: string;
	},
): Promise<string> {
	const token = crypto.randomUUID();
	await ctx.db.insert("discordActionTokens", {
		token,
		actionKind: args.actionKind,
		userId: args.userId,
		taskId: args.taskId,
		commentId: args.commentId,
		updateId: args.updateId,
		reminderId: args.reminderId,
		status: args.status,
		messageId: args.messageId,
		channelId: args.channelId,
		expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
		consumedAt: undefined,
		createdAt: Date.now(),
	});
	return `${HQ_ACTION_TOKEN_PREFIX}${token}`;
}

async function buildTaskStatusButtons(
	ctx: MutationCtx,
	args: {
		task: Doc<"tasks">;
		userId?: Id<"users">;
		reminderId?: Id<"reminders">;
	},
): Promise<DiscordActionButtonSpec[]> {
	const buttons: DiscordActionButtonSpec[] = [];
	const statusButtons: Array<{
		status: Doc<"tasks">["status"];
		label: string;
		style: 1 | 2 | 3 | 4;
	}> = [
		{ status: "in-progress", label: "Start", style: 1 },
		{ status: "awaiting-review", label: "Review", style: 2 },
		{ status: "done", label: "Done", style: 3 },
	];
	for (const button of statusButtons) {
		if (button.status === args.task.status) {
			continue;
		}
		buttons.push({
			customId: await insertDiscordActionToken(ctx, {
				actionKind: "set_task_status",
				userId: args.userId,
				taskId: args.task._id,
				reminderId: args.reminderId,
				status: button.status,
			}),
			label: button.label,
			style: button.style,
		});
	}
	return buttons;
}

async function buildTaskApprovalButtons(
	ctx: MutationCtx,
	args: {
		task: Doc<"tasks">;
		userId?: Id<"users">;
		isTaskAwaitingReview: boolean;
		isTaskUnapproved: boolean;
	},
): Promise<DiscordActionButtonSpec[]> {
	const buttons: DiscordActionButtonSpec[] = [];

	if (args.isTaskAwaitingReview || args.isTaskUnapproved) {
		buttons.push({
			customId: await insertDiscordActionToken(ctx, {
				actionKind: "approve_task",
				userId: args.userId,
				taskId: args.task._id,
			}),
			label: "Approve",
			style: 3,
		});
	}

	if (args.isTaskUnapproved || args.task.approvedByIds?.length) {
		buttons.push({
			customId: await insertDiscordActionToken(ctx, {
				actionKind: "unapprove_task",
				userId: args.userId,
				taskId: args.task._id,
			}),
			label: "Unapprove",
			style: 2,
		});
	}

	return buttons;
}

async function buildDiscordActionButtons(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entity: NotificationEntityRef;
		userId?: Id<"users">;
		payloadJson?: string;
	},
): Promise<DiscordActionButtonSpec[]> {
	const buttons: DiscordActionButtonSpec[] = [];
	const payload = parsePayloadJson(args.payloadJson);

	// Task-based notifications get status buttons
	if (args.entity.entityType === "task") {
		const task = await ctx.db.get("tasks", args.entity.entityId);
		if (task) {
			const statusButtons = await buildTaskStatusButtons(ctx, {
				task,
				userId: args.userId,
				reminderId: (() => {
					if (
						args.type !== "reminder_triggered" ||
						typeof payload.reminderId !== "string"
					) {
						return undefined;
					}
					return (
						ctx.db.normalizeId("reminders", payload.reminderId) ?? undefined
					);
				})(),
			});
			buttons.push(...statusButtons);

			const approvalButtons = await buildTaskApprovalButtons(ctx, {
				task,
				userId: args.userId,
				isTaskAwaitingReview:
					task.status === "awaiting-review" ||
					args.type === "task_awaiting_review",
				isTaskUnapproved: args.type === "task_unapproved",
			});
			buttons.push(...approvalButtons);

			buttons.push({
				customId: await insertDiscordActionToken(ctx, {
					actionKind: "open_task_comment_modal",
					userId: args.userId,
					taskId: task._id,
				}),
				label: "Comment",
				style: 2,
			});
		}
	}
	// Comment-based notifications only get reply button
	else if (args.entity.entityType === "comment") {
		buttons.push({
			customId: await insertDiscordActionToken(ctx, {
				actionKind: "open_task_reply_modal",
				userId: args.userId,
				taskId: args.entity.parentTaskId,
				commentId: args.entity.entityId,
			}),
			label: "Reply",
			style: 1,
		});
	}
	// Competition update notifications only get comment button
	else if (
		args.type === "progress_update_added" &&
		typeof payload.updateId === "string"
	) {
		const updateId = ctx.db.normalizeId("competitionUpdates", payload.updateId);
		if (updateId) {
			buttons.push({
				customId: await insertDiscordActionToken(ctx, {
					actionKind: "open_update_comment_modal",
					userId: args.userId,
					updateId,
				}),
				label: "Comment",
				style: 2,
			});
		}
	}

	// All notifications get a dismiss button
	buttons.push({
		customId: await insertDiscordActionToken(ctx, {
			actionKind: "dismiss_message",
			userId: args.userId,
		}),
		label: "Dismiss",
		style: 2,
	});

	return buttons;
}

async function buildDiscordMessagePayload(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entity: NotificationEntityRef;
		userId?: Id<"users">;
		title: string;
		message: string;
		priority?: "urgent" | "high" | "normal";
		payloadJson?: string;
	},
): Promise<DiscordMessagePayload> {
	return {
		title: args.title,
		message: args.message,
		url: buildDiscordNotificationUrl(args.entity),
		actions: await buildDiscordActionButtons(ctx, {
			type: args.type,
			entity: args.entity,
			userId: args.userId,
			payloadJson: args.payloadJson,
		}),
		priority: args.priority,
	};
}

async function scheduleDiscordDm(
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
		type: args.input.type,
		entity: args.input.entity,
		userId: args.recipientId,
		title: args.input.title,
		message: args.input.message,
		priority: args.input.priority as "urgent" | "high" | "normal" | undefined,
		payloadJson: args.input.payloadJson,
	});

	await ctx.scheduler.runAfter(
		0,
		internal.discord.actions.sendNotificationMessageAction,
		{
			destinationKind: "dm",
			targetId: link.discordUserId,
			title: message.title,
			message: message.message,
			url: message.url,
			actions: message.actions,
			priority: message.priority,
		},
	);
	return true;
}

async function resolveDiscordChannelForEntity(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions">["discordChannel"] | null> {
	if (entity.entityType === "competition") {
		const competition = await ctx.db.get("competitions", entity.entityId);
		return competition?.discordChannel ?? null;
	}
	if (entity.entityType === "task") {
		const task = await ctx.db.get("tasks", entity.entityId);
		if (!task?.parentCompetitionId) {
			return null;
		}
		const competition = await ctx.db.get(
			"competitions",
			task.parentCompetitionId,
		);
		return competition?.discordChannel ?? null;
	}
	if (entity.parentTaskId) {
		const task = await ctx.db.get("tasks", entity.parentTaskId);
		if (!task?.parentCompetitionId) {
			return null;
		}
		const competition = await ctx.db.get(
			"competitions",
			task.parentCompetitionId,
		);
		return competition?.discordChannel ?? null;
	}
	return null;
}

async function resolveGlobalChannelNotificationTypes(
	ctx: MutationCtx,
): Promise<Set<NotificationType>> {
	const defaults = await ctx.db.query("discordChannelDefaults").first();
	if (!defaults) {
		return new Set(DISCORD_CHANNEL_NOTIFICATION_TYPES);
	}
	return new Set(
		defaults.notificationTypes.filter((t) =>
			DISCORD_CHANNEL_NOTIFICATION_TYPES.has(t as NotificationType),
		) as NotificationType[],
	);
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
		channel.notificationTypeOverrides.filter((t) =>
			DISCORD_CHANNEL_NOTIFICATION_TYPES.has(t as NotificationType),
		) as NotificationType[],
	);
}

async function scheduleDiscordChannel(
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

	const entityUrl = buildDiscordNotificationUrl(input.entity);
	const actions: DiscordActionButtonSpec[] = [];
	if (entityUrl) {
		actions.push({
			customId: `hq_link:${entityUrl}`,
			label: "View in HQ",
			style: 5,
		});
	}

	await ctx.scheduler.runAfter(
		0,
		internal.discord.actions.sendNotificationMessageAction,
		{
			destinationKind: "channel",
			targetId: channel.channelId,
			title: input.title,
			message: input.message,
			url: entityUrl,
			actions,
			priority: input.priority as "urgent" | "high" | "normal" | undefined,
		},
	);
	return true;
}

async function dispatchNotification(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<boolean> {
	const recipients = await expandRecipientIds(ctx, input);
	let sent = false;

	for (const recipientId of recipients) {
		if (
			input.suppressActorRecipient !== false &&
			input.actorId &&
			recipientId === input.actorId
		) {
			continue;
		}

		const hasAccess = await canUserAccessNotificationEntity(
			ctx,
			recipientId,
			input.entity,
		);
		if (!hasAccess) {
			continue;
		}

		sent = (await scheduleDiscordDm(ctx, { recipientId, input })) || sent;
	}

	sent = (await scheduleDiscordChannel(ctx, input)) || sent;
	return sent;
}

async function emitFromConfig(
	ctx: MutationCtx,
	config: NotificationTemplateConfig,
	opts: Omit<
		NotificationEmitInput,
		"title" | "message" | "priority" | "metadata" | "body"
	>,
): Promise<boolean> {
	const emitInput = buildNotificationEmitInput({
		eventKey: opts.type,
		base: {
			...opts,
			title: config.title,
			message: config.message,
			priority: config.priority,
			metadata: config.metadata,
			body: config.body,
		},
		overrides: {
			includeEntitySubscribers: opts.includeEntitySubscribers,
			suppressActorRecipient: opts.suppressActorRecipient,
		},
	});
	return dispatchNotification(ctx, emitInput);
}

async function createTaskNotification(
	ctx: MutationCtx,
	type: TemplateTaskNotificationType,
	args: TaskNotificationBuildArgs,
): Promise<null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) {
		return null;
	}

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
	if (!result) {
		return null;
	}

	const isTargeted = type === "task_mentioned" || type === "comment_replied";
	await emitFromConfig(ctx, result.config, {
		type,
		entity: result.entity,
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${type}:${task._id}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
		...(isTargeted ? { includeEntitySubscribers: false } : {}),
	});
	return null;
}

async function createCompetitionNotification(
	ctx: MutationCtx,
	args: CompetitionNotificationBuildArgs,
): Promise<null> {
	const competition = await ctx.db.get("competitions", args.competitionId);
	if (!competition) {
		return null;
	}

	const actor = await getActorInfo(ctx, args.actorId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	const result = buildCompetitionNotificationResult(competition, actor, args, {
		type: args.type,
		competitionId: args.competitionId,
		eventKey,
		...(args.type === "progress_update_added"
			? { updateId: args.updateId }
			: {}),
	});
	if (!result) {
		return null;
	}

	await emitFromConfig(ctx, result.config, {
		type: args.type,
		entity: { entityType: "competition", entityId: competition._id },
		recipients: resolveRecipientIds(args),
		actorId: args.actorId,
		idempotencyBase: `${args.type}:${competition._id}:${eventKey}`,
		payloadJson: serializePayload(result.payload),
	});
	return null;
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
): Promise<null> {
	const reminder = await ctx.db.get("reminders", args.reminderId);
	if (!reminder) {
		return null;
	}

	const task = await ctx.db.get("tasks", args.taskId);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	await emitFromConfig(
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
			suppressActorRecipient: false,
		},
	);
	return null;
}

function mapTaskEventArgs(args: {
	type: TaskEventType;
	taskId: Id<"tasks">;
	actorId: Id<"users">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	commentId?: Id<"comments">;
	oldStatus?: string;
	newStatus?: string;
	oldPriority?: string;
	newPriority?: string;
	oldDueDate?: string;
	newDueDate?: string;
	blockingTaskId?: Id<"tasks">;
	eventKey?: string;
}): TaskNotificationBuildArgs {
	return {
		taskId: args.taskId,
		actorId: args.actorId,
		recipientId: args.recipientId,
		recipientIds: args.recipientIds,
		commentId: args.commentId,
		oldStatus: args.oldStatus,
		newStatus: args.newStatus,
		oldPriority: args.oldPriority,
		newPriority: args.newPriority,
		oldDueDate: args.oldDueDate,
		newDueDate: args.newDueDate,
		blockingTaskId: args.blockingTaskId,
		eventKey: args.eventKey,
	};
}

export async function emitNotificationEvent(
	ctx: MutationCtx,
	args: EmitNotificationEventArgs,
): Promise<null> {
	switch (args.type) {
		case "task_assigned":
		case "task_unassigned":
		case "task_mentioned":
		case "comment_added":
		case "comment_replied":
		case "task_status_changed":
		case "task_priority_changed":
		case "task_awaiting_review":
		case "task_approved":
		case "task_unapproved":
		case "due_date_changed":
		case "relation_blocked":
		case "relation_unblocked":
			return createTaskNotification(ctx, args.type, mapTaskEventArgs(args));
		case "due_date_approaching":
			return emitDueDateUrgencyNotification(ctx, "due_date_approaching", {
				taskId: args.taskId,
				assigneeId: args.assigneeId,
				days: args.daysUntil,
				eventKey: args.eventKey,
			});
		case "due_date_overdue":
			return emitDueDateUrgencyNotification(ctx, "due_date_overdue", {
				taskId: args.taskId,
				assigneeId: args.assigneeId,
				days: args.daysOverdue,
				eventKey: args.eventKey,
			});
		case "competition_phase_changed":
		case "progress_update_added":
			return createCompetitionNotification(ctx, args);
		case "reminder_triggered":
			return createReminderNotification(ctx, args);
	}
}

async function emitDueDateNotification(
	ctx: MutationCtx,
	task: Doc<"tasks">,
	recipientId: Id<"users">,
	spec: DueDateNotificationSpec,
): Promise<number> {
	const sent = await emitFromConfig(ctx, spec.config, {
		type: spec.type,
		entity: { entityType: "task", entityId: task._id },
		recipients: [recipientId],
		idempotencyBase: spec.idempotencyBase,
		payloadJson: serializePayload(spec.payload),
		includeEntitySubscribers: true,
	});
	return sent ? 1 : 0;
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

async function emitDueDateUrgencyNotification(
	ctx: MutationCtx,
	type: "due_date_approaching" | "due_date_overdue",
	args: {
		taskId: Id<"tasks">;
		assigneeId: Id<"users">;
		days: number;
		eventKey?: string;
	},
): Promise<null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task?.dueDate) {
		return null;
	}

	const config =
		type === "due_date_approaching"
			? NotificationTemplates.due_date_approaching(task, args.days)
			: NotificationTemplates.due_date_overdue(task, args.days);
	const eventKey = args.eventKey ?? `${Date.now()}`;
	await emitFromConfig(ctx, config, {
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
	return null;
}

export async function emitDueDateNotificationsForTask(
	ctx: MutationCtx,
	taskId: Id<"tasks">,
	now: number = Date.now(),
): Promise<number> {
	const task = await ctx.db.get("tasks", taskId);
	if (!task) {
		return 0;
	}
	return maybeEmitDueDateNotificationForTask(ctx, task, now);
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

const stale = (
	label: string,
	description: string,
): SubscriptionPresentation => ({
	label,
	description,
	isStale: true,
});

function entityRefFromSubscriptionArg(
	entity: EntitySubscriptionArg,
): NotificationEntityRef {
	return entity.entityType === "comment"
		? { entityType: "comment", entityId: entity.entityId }
		: entity;
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
			message: "You do not have access to watch this entity.",
		});
	}
}

async function findUserEntitySubscription(
	ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
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
		.unique();
}

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
		if (!(await canUserAccessTask(ctx, userId, taskId))) {
			return stale("Restricted task", "Task");
		}
		return {
			label: `${task.identifier}: ${task.title}`,
			description: "Task",
			isStale: false,
		};
	}

	if (entityType === "competition") {
		const competitionId = ctx.db.normalizeId("competitions", entityId);
		if (!competitionId) return stale("Deleted competition", "Competition");
		const competition = await ctx.db.get("competitions", competitionId);
		if (!competition) return stale("Deleted competition", "Competition");
		if (!(await canUserAccessCompetition(ctx, userId, competitionId))) {
			return stale("Restricted competition", "Competition");
		}
		return {
			label: competition.name,
			description: "Competition",
			isStale: false,
		};
	}

	const commentId = ctx.db.normalizeId("comments", entityId);
	if (!commentId) return stale("Deleted comment", "Comment");
	const comment = await ctx.db.get("comments", commentId);
	if (!comment) return stale("Deleted comment", "Comment");
	if (!(await canUserAccessComment(ctx, userId, commentId))) {
		return stale("Restricted comment", "Comment");
	}

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
	if (!update) {
		return stale("Comment on deleted update", "Competition update comment");
	}
	const competition = await ctx.db.get("competitions", update.competitionId);
	return {
		label: competition
			? `Comment on ${competition.name}`
			: "Comment on competition update",
		description: "Competition update comment",
		isStale: competition === null,
	};
}

export const listSubscriptions = query({
	args: { limit: v.optional(v.number()) },
	returns: v.array(notificationSubscriptionReturns),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = normalizeSubscriptionListLimit(args.limit);
		const docs = await ctx.db
			.query("notificationSubscriptions")
			.withIndex("by_user_updated_at", (q) => q.eq("userId", userId))
			.order("desc")
			.take(limit);

		return Promise.all(
			docs.map(async (doc) => {
				const presentation = await describeEntitySubscription(
					ctx,
					userId,
					doc.entityType,
					doc.entityId,
				);
				return {
					id: doc._id,
					entityType: doc.entityType,
					entityId: doc.entityId,
					label: presentation.label,
					description: presentation.description,
					isStale: presentation.isStale,
					updatedAt: toISO(doc.updatedAt),
				};
			}),
		);
	},
});

export const isSubscribedToEntity = query({
	args: { entity: entitySubscriptionArgs },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (!existing) {
			return false;
		}
		return canUserAccessNotificationEntity(
			ctx,
			userId,
			entityRefFromSubscriptionArg(args.entity),
		);
	},
});

export const subscribeToEntity = mutation({
	args: { entity: entitySubscriptionArgs },
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
		if (existing) {
			return existing._id;
		}

		return ctx.db.insert("notificationSubscriptions", {
			userId,
			entityType: args.entity.entityType,
			entityId,
			updatedAt: Date.now(),
		});
	},
});

export const unsubscribeFromEntity = mutation({
	args: { entity: entitySubscriptionArgs },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const existing = await findUserEntitySubscription(
			ctx,
			userId,
			args.entity.entityType,
			`${args.entity.entityId}`,
		);
		if (existing) {
			await ctx.db.delete("notificationSubscriptions", existing._id);
		}
		return null;
	},
});

export const unsubscribe = mutation({
	args: { subscriptionId: v.id("notificationSubscriptions") },
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
