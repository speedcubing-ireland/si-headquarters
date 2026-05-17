import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUserId } from "../core/auth";
import { resolveHqSiteBaseUrl } from "../lib/siteUrls";
import { getCommentParentId } from "../lib/commentParentId";
import { toISO } from "../lib/transforms";
import {
	PRIORITY_LABELS,
	PROGRESS_STATUS_LABELS,
	STATUS_LABELS,
} from "../lib/constants";
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
	getEntitySubscriberIds,
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
import {
	filterChannelWatcherNotificationTypes,
	getDefaultWatcherNotificationTypes,
	isTargetedNotificationType,
	type NotificationWatcherLevel,
	type WatcherNotificationType,
} from "./lib/watcherPolicy";
import { HQ_ACTION_TOKEN_PREFIX } from "../discord/interactions";

type DiscordActionButtonSpec = {
	customId: string;
	label: string;
	style: 1 | 2 | 3 | 4 | 5;
	url?: string;
};

type DiscordMessagePayload = {
	title: string;
	message: string;
	description?: string;
	url?: string;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	author?: { name: string; iconUrl?: string };
	actions: DiscordActionButtonSpec[];
	priority?: "urgent" | "high" | "normal";
};

type DiscordDestinationKind = "dm" | "channel";

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
	forceRecipientDelivery?: boolean;
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
			forceRecipientDelivery?: boolean;
	  }
	| {
			type: "due_date_overdue";
			taskId: Id<"tasks">;
			assigneeId: Id<"users">;
			daysOverdue: number;
			eventKey?: string;
			forceRecipientDelivery?: boolean;
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
			forceRecipientDelivery?: boolean;
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
			forceRecipientDelivery?: boolean;
	  }
	| {
			type: "reminder_triggered";
			reminderId: Id<"reminders">;
			userId: Id<"users">;
			taskId: Id<"tasks">;
			message?: string;
			eventKey?: string;
			forceRecipientDelivery?: boolean;
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

async function resolveWatcherNotificationTypes(
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

async function getTaskForNotificationEntity(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Doc<"tasks"> | null> {
	if (entity.entityType === "task") {
		return await ctx.db.get("tasks", entity.entityId);
	}
	if (
		(entity.entityType === "comment" || entity.entityType === "reminder") &&
		entity.parentTaskId
	) {
		return await ctx.db.get("tasks", entity.parentTaskId);
	}
	return null;
}

async function getCompetitionForNotificationEntity(
	ctx: Pick<MutationCtx, "db">,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions"> | null> {
	if (entity.entityType === "competition") {
		return await ctx.db.get("competitions", entity.entityId);
	}
	const task = await getTaskForNotificationEntity(ctx, entity);
	if (!task?.parentCompetitionId) {
		return null;
	}
	return await ctx.db.get("competitions", task.parentCompetitionId);
}

async function getCompetitionWatcherRecipientIds(
	ctx: Pick<MutationCtx, "db">,
	competition: Doc<"competitions">,
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
	task: Doc<"tasks">,
): Promise<Id<"users">[]> {
	const subscribers = new Set<Id<"users">>();
	let currentTask: Doc<"tasks"> | null = task;
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

async function expandNotificationRecipientsByWatcherPolicy(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<Id<"users">[]> {
	if (input.forceRecipientDelivery || isTargetedNotificationType(input.type)) {
		return [...new Set(input.recipients)];
	}

	const recipients = new Set<Id<"users">>();
	const task = await getTaskForNotificationEntity(ctx, input.entity);
	const competition = await getCompetitionForNotificationEntity(
		ctx,
		input.entity,
	);

	for (const recipientId of input.recipients) {
		recipients.add(recipientId);
	}

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
			task,
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

function truncateDiscordPreview(
	value: string | undefined,
	maxLength = 220,
): string {
	const trimmed = value?.trim();
	if (!trimmed) return "";
	if (trimmed.length <= maxLength) return trimmed;
	return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

function labelForStatus(status: string | undefined): string {
	return status ? (STATUS_LABELS[status] ?? status) : "Unknown";
}

function labelForPriority(priority: string | undefined): string {
	return priority ? (PRIORITY_LABELS[priority] ?? priority) : "Unknown";
}

function progressStatusIcon(status: string | undefined): string {
	if (status === "on-track") return ":green_circle:";
	if (status === "at-risk") return ":yellow_circle:";
	if (status === "off-track") return ":red_circle:";
	return ":blue_circle:";
}

function actorAuthor(
	input: NotificationEmitInput,
): { name: string; iconUrl?: string } | undefined {
	const actorName = input.metadata?.actorName;
	if (!actorName) return undefined;
	return {
		name: actorName,
		iconUrl: input.metadata?.actorAvatarUrl,
	};
}

async function buildTaskDiscordEmbed(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		task: Doc<"tasks">;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
		payload: Record<string, string | number | boolean | null | undefined>;
	},
): Promise<
	Pick<DiscordMessagePayload, "title" | "description" | "fields" | "author">
> {
	const { input, task, destinationKind, payload } = args;
	const competition = task.parentCompetitionId
		? await ctx.db.get("competitions", task.parentCompetitionId)
		: null;
	const title = competition?.name ?? input.title;
	const description = `**${task.identifier}: ${task.title}**`;
	const actorName = input.metadata?.actorName ?? "Someone";
	const oldValue =
		typeof payload.oldStatus === "string"
			? payload.oldStatus
			: typeof payload.oldPriority === "string"
				? payload.oldPriority
				: typeof payload.oldDueDate === "string"
					? payload.oldDueDate
					: input.metadata?.oldValue;
	const newValue =
		typeof payload.newStatus === "string"
			? payload.newStatus
			: typeof payload.newPriority === "string"
				? payload.newPriority
				: typeof payload.newDueDate === "string"
					? payload.newDueDate
					: input.metadata?.newValue;

	switch (input.type) {
		case "task_assigned":
			return {
				title,
				description,
				fields: [
					{
						name: ":bust_in_silhouette: Task Assigned",
						value:
							destinationKind === "dm"
								? "You were assigned to this task."
								: `${actorName} assigned this task.`,
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_unassigned":
			return {
				title,
				description,
				fields: [
					{
						name: ":busts_in_silhouette: Task Unassigned",
						value:
							destinationKind === "dm"
								? "You were unassigned from this task."
								: `${actorName} removed the assignee from this task.`,
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_status_changed":
			return {
				title,
				description,
				fields: [
					{
						name: `:arrows_counterclockwise: Status Changed - ${labelForStatus(
							typeof newValue === "string" ? newValue : undefined,
						)}`,
						value: `Moved from **${labelForStatus(
							typeof oldValue === "string" ? oldValue : undefined,
						)}** to **${labelForStatus(
							typeof newValue === "string" ? newValue : undefined,
						)}**.`,
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_priority_changed":
			return {
				title,
				description,
				fields: [
					{
						name: `:warning: Priority Changed - ${labelForPriority(
							typeof newValue === "string" ? newValue : undefined,
						)}`,
						value: `Changed from **${labelForPriority(
							typeof oldValue === "string" ? oldValue : undefined,
						)}** to **${labelForPriority(
							typeof newValue === "string" ? newValue : undefined,
						)}**.`,
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_awaiting_review":
			return {
				title,
				description,
				fields: [
					{
						name: ":mag: Task Awaiting Review",
						value: "This task is ready for review.",
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_approved":
			return {
				title,
				description,
				fields: [
					{
						name: ":thumbsup: Task Approved",
						value:
							task.status === "awaiting-review"
								? "This task received an approval."
								: "This task received an approval. If all approvals are complete, it may now be done.",
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "task_unapproved":
			return {
				title,
				description,
				fields: [
					{
						name: ":x: Approval Withdrawn",
						value: "This task is no longer fully approved.",
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "due_date_changed": {
			const oldDate = typeof oldValue === "string" ? oldValue : undefined;
			const newDate = typeof newValue === "string" ? newValue : undefined;
			const value =
				!oldDate && newDate
					? `Set to **${newDate}**.`
					: oldDate && !newDate
						? `Removed due date, previously **${oldDate}**.`
						: `Changed from **${oldDate ?? "none"}** to **${newDate ?? "none"}**.`;
			return {
				title,
				description,
				fields: [{ name: ":calendar: Due Date Changed", value, inline: false }],
				author: actorAuthor(input),
			};
		}
		case "due_date_approaching": {
			const days =
				typeof payload.daysUntil === "number"
					? payload.daysUntil
					: typeof payload.daysDiff === "number"
						? payload.daysDiff
						: undefined;
			return {
				title,
				description,
				fields: [
					{
						name:
							days === 0 ? ":alarm_clock: Due Today" : ":alarm_clock: Due Soon",
						value:
							days === 0
								? "This task is due **today**."
								: `This task is due in **${days ?? "a few"} days**.`,
						inline: false,
					},
				],
			};
		}
		case "due_date_overdue": {
			const days =
				typeof payload.daysOverdue === "number"
					? payload.daysOverdue
					: undefined;
			return {
				title,
				description,
				fields: [
					{
						name: `:rotating_light: Task Overdue${
							days ? ` - ${days} ${days === 1 ? "Day" : "Days"}` : ""
						}`,
						value: task.dueDate
							? `This task was due on **${task.dueDate.slice(0, 10)}**.`
							: "This task is overdue.",
						inline: false,
					},
				],
			};
		}
		case "relation_unblocked": {
			const blockerId =
				typeof payload.blockingTaskId === "string"
					? ctx.db.normalizeId("tasks", payload.blockingTaskId)
					: null;
			const blocker = blockerId ? await ctx.db.get("tasks", blockerId) : null;
			return {
				title,
				description,
				fields: [
					{
						name: ":white_check_mark: Task Unblocked",
						value: blocker
							? `The blocker **${blocker.identifier}: ${blocker.title}** was resolved. This task can move again.`
							: "A blocker was resolved. This task can move again.",
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		}
		case "relation_blocked":
			return {
				title,
				description,
				fields: [
					{
						name: ":construction: Task Blocked",
						value:
							"This task is blocked. This notification type is disabled by default.",
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		case "comment_added":
		case "task_mentioned":
		case "comment_replied": {
			const comment =
				input.entity.entityType === "comment"
					? await ctx.db.get("comments", input.entity.entityId)
					: null;
			const preview = truncateDiscordPreview(comment?.content);
			const name =
				input.type === "task_mentioned"
					? ":speech_balloon: Mentioned in a Comment"
					: input.type === "comment_replied"
						? ":left_speech_bubble: Reply to Your Comment"
						: ":speech_balloon: New Comment";
			return {
				title,
				description,
				fields: [
					{
						name,
						value: preview
							? `**${actorName}:** ${preview}`
							: `${actorName} added a comment.`,
						inline: false,
					},
				],
				author: actorAuthor(input),
			};
		}
		default:
			return { title: input.title, description: input.message };
	}
}

async function buildCompetitionDiscordEmbed(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		competition: Doc<"competitions">;
		payload: Record<string, string | number | boolean | null | undefined>;
	},
): Promise<
	Pick<DiscordMessagePayload, "title" | "description" | "fields" | "author">
> {
	const { input, competition, payload } = args;
	if (input.type === "competition_phase_changed") {
		const oldPhase =
			typeof payload.oldPhaseName === "string"
				? payload.oldPhaseName
				: input.metadata?.oldValue;
		const newPhase =
			typeof payload.newPhaseName === "string"
				? payload.newPhaseName
				: input.metadata?.newValue;
		return {
			title: competition.name,
			fields: [
				{
					name: `:twisted_rightwards_arrows: Phase Changed - ${
						newPhase ?? "Updated"
					}`,
					value: `Moved from **${oldPhase ?? "Unknown"}** to **${
						newPhase ?? "Unknown"
					}**.`,
					inline: false,
				},
			],
			author: actorAuthor(input),
		};
	}

	if (input.type === "progress_update_added") {
		const status =
			typeof payload.status === "string"
				? payload.status
				: input.metadata?.newValue;
		const updateId =
			typeof payload.updateId === "string"
				? ctx.db.normalizeId("competitionUpdates", payload.updateId)
				: null;
		const update = updateId
			? await ctx.db.get("competitionUpdates", updateId)
			: null;
		const statusLabel = status
			? (PROGRESS_STATUS_LABELS[status] ?? status)
			: "Update";
		return {
			title: competition.name,
			fields: [
				{
					name: `${progressStatusIcon(status)} Update Posted - ${statusLabel}`,
					value:
						truncateDiscordPreview(update?.message) ||
						"A progress update was posted.",
					inline: false,
				},
			],
			author: actorAuthor(input),
		};
	}

	return { title: input.title, description: input.message };
}

async function buildReminderDiscordEmbed(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		taskId?: Id<"tasks">;
		payload: Record<string, string | number | boolean | null | undefined>;
	},
): Promise<
	Pick<DiscordMessagePayload, "title" | "description" | "fields" | "author">
> {
	const task = args.taskId ? await ctx.db.get("tasks", args.taskId) : null;
	const competition = task?.parentCompetitionId
		? await ctx.db.get("competitions", task.parentCompetitionId)
		: null;
	return {
		title: competition?.name ?? args.input.title,
		description: task ? `**${task.identifier}: ${task.title}**` : undefined,
		fields: [
			{
				name: ":alarm_clock: Reminder",
				value:
					truncateDiscordPreview(args.input.message) ||
					(task
						? `Reminder for **${task.identifier}: ${task.title}**.`
						: "Reminder triggered."),
				inline: false,
			},
		],
	};
}

async function buildDiscordEmbedPayload(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
		payload: Record<string, string | number | boolean | null | undefined>;
	},
): Promise<
	Pick<DiscordMessagePayload, "title" | "description" | "fields" | "author">
> {
	if (args.input.entity.entityType === "reminder") {
		return buildReminderDiscordEmbed(ctx, {
			input: args.input,
			taskId: args.input.entity.parentTaskId,
			payload: args.payload,
		});
	}
	const task = await getTaskForNotificationEntity(ctx, args.input.entity);
	if (task) {
		return buildTaskDiscordEmbed(ctx, { ...args, task });
	}
	const competition = await getCompetitionForNotificationEntity(
		ctx,
		args.input.entity,
	);
	if (competition) {
		return buildCompetitionDiscordEmbed(ctx, {
			input: args.input,
			competition,
			payload: args.payload,
		});
	}
	return { title: args.input.title, description: args.input.message };
}

async function buildTaskStatusButton(
	ctx: MutationCtx,
	args: {
		task: Doc<"tasks">;
		userId?: Id<"users">;
		reminderId?: Id<"reminders">;
		status: Doc<"tasks">["status"];
		label: string;
		style: 1 | 2 | 3 | 4;
	},
): Promise<DiscordActionButtonSpec | null> {
	if (args.status === args.task.status) {
		return null;
	}
	return {
		customId: await insertDiscordActionToken(ctx, {
			actionKind: "set_task_status",
			userId: args.userId,
			taskId: args.task._id,
			reminderId: args.reminderId,
			status: args.status,
		}),
		label: args.label,
		style: args.style,
	};
}

async function buildTaskApprovalButton(
	ctx: MutationCtx,
	args: {
		task: Doc<"tasks">;
		userId?: Id<"users">;
		action: "approve_task" | "unapprove_task";
		label: string;
		style: 1 | 2 | 3 | 4;
	},
): Promise<DiscordActionButtonSpec> {
	return {
		customId: await insertDiscordActionToken(ctx, {
			actionKind: args.action,
			userId: args.userId,
			taskId: args.task._id,
		}),
		label: args.label,
		style: args.style,
	};
}

async function buildDiscordActionButtons(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entity: NotificationEntityRef;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
		payloadJson?: string;
	},
): Promise<DiscordActionButtonSpec[]> {
	const buttons: DiscordActionButtonSpec[] = [];
	const payload = parsePayloadJson(args.payloadJson);
	const baseUrl = resolveHqSiteBaseUrl();
	const entityUrl = buildDiscordNotificationUrl(args.entity);
	if (entityUrl) {
		buttons.push({
			customId: entityUrl,
			label:
				args.type === "progress_update_added"
					? "View Update"
					: args.entity.entityType === "competition"
						? "View Competition"
						: args.entity.entityType === "comment"
							? "View Comment"
							: args.entity.entityType === "reminder"
								? "View Task"
								: "View Task",
			style: 5,
			url: entityUrl,
		});
	}

	const task = await getTaskForNotificationEntity(ctx, args.entity);
	const reminderId =
		args.type === "reminder_triggered" && typeof payload.reminderId === "string"
			? (ctx.db.normalizeId("reminders", payload.reminderId) ?? undefined)
			: undefined;
	const addTaskCommentButton = async () => {
		if (!task) return;
		buttons.push({
			customId: await insertDiscordActionToken(ctx, {
				actionKind: "open_task_comment_modal",
				userId: args.userId,
				taskId: task._id,
			}),
			label: "Comment",
			style: 2,
		});
	};
	const addStartTaskButton = async () => {
		if (!task) return;
		const button = await buildTaskStatusButton(ctx, {
			task,
			userId: args.userId,
			reminderId,
			status: "in-progress",
			label: "Start Task",
			style: 1,
		});
		if (button) buttons.push(button);
	};
	const addMarkDoneButton = async () => {
		if (!task) return;
		const button = await buildTaskStatusButton(ctx, {
			task,
			userId: args.userId,
			reminderId,
			status: "done",
			label: "Mark Done",
			style: 3,
		});
		if (button) buttons.push(button);
	};

	if (task) {
		switch (args.type) {
			case "task_assigned":
				await addStartTaskButton();
				await addTaskCommentButton();
				break;
			case "task_unassigned":
				await addTaskCommentButton();
				break;
			case "task_status_changed":
				if (payload.newStatus === "awaiting-review") {
					buttons.push(
						await buildTaskApprovalButton(ctx, {
							task,
							userId: args.userId,
							action: "approve_task",
							label: "Approve",
							style: 3,
						}),
					);
					await addTaskCommentButton();
				} else if (payload.newStatus === "done") {
					buttons.push(
						await buildTaskApprovalButton(ctx, {
							task,
							userId: args.userId,
							action: "unapprove_task",
							label: "Unapprove",
							style: 2,
						}),
					);
				} else {
					await addTaskCommentButton();
				}
				break;
			case "task_priority_changed":
				await addStartTaskButton();
				await addTaskCommentButton();
				break;
			case "task_awaiting_review":
				buttons.push(
					await buildTaskApprovalButton(ctx, {
						task,
						userId: args.userId,
						action: "approve_task",
						label: "Approve",
						style: 3,
					}),
				);
				await addTaskCommentButton();
				break;
			case "due_date_approaching":
			case "due_date_overdue":
				await addMarkDoneButton();
				await addTaskCommentButton();
				break;
			case "relation_blocked":
				if (typeof payload.blockingTaskId === "string") {
					buttons.push({
						customId: `${baseUrl}/tasks/${payload.blockingTaskId}`,
						label: "View Blocker",
						style: 5,
						url: `${baseUrl}/tasks/${payload.blockingTaskId}`,
					});
				}
				await addTaskCommentButton();
				break;
			case "relation_unblocked":
				await addStartTaskButton();
				if (typeof payload.blockingTaskId === "string") {
					buttons.push({
						customId: `${baseUrl}/tasks/${payload.blockingTaskId}`,
						label: "View Former Blocker",
						style: 5,
						url: `${baseUrl}/tasks/${payload.blockingTaskId}`,
					});
				}
				break;
			case "task_approved":
				buttons.push(
					await buildTaskApprovalButton(ctx, {
						task,
						userId: args.userId,
						action: "unapprove_task",
						label: "Unapprove",
						style: 2,
					}),
				);
				break;
			case "task_unapproved":
				buttons.push(
					await buildTaskApprovalButton(ctx, {
						task,
						userId: args.userId,
						action: "approve_task",
						label: "Approve",
						style: 3,
					}),
				);
				await addTaskCommentButton();
				break;
			case "due_date_changed":
				await addTaskCommentButton();
				break;
			case "reminder_triggered":
				await addMarkDoneButton();
				break;
		}
	}

	if (args.entity.entityType === "comment") {
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

	if (
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

	if (args.destinationKind !== "dm") {
		return buttons.slice(0, 5);
	}

	const dismissButton: DiscordActionButtonSpec = {
		customId: await insertDiscordActionToken(ctx, {
			actionKind: "dismiss_message",
			userId: args.userId,
		}),
		label: "Dismiss",
		style: 2,
	};
	return [...buttons.slice(0, 4), dismissButton];
}

async function buildDiscordMessagePayload(
	ctx: MutationCtx,
	args: {
		type: NotificationType;
		entity: NotificationEntityRef;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
		title: string;
		message: string;
		priority?: "urgent" | "high" | "normal";
		payloadJson?: string;
		metadata?: NotificationEmitInput["metadata"];
	},
): Promise<DiscordMessagePayload> {
	const input = {
		type: args.type,
		entity: args.entity,
		recipients: [],
		title: args.title,
		message: args.message,
		priority: args.priority ?? "normal",
		metadata: args.metadata,
		idempotencyBase: "",
		payloadJson: args.payloadJson,
	} satisfies NotificationEmitInput;
	const payload = parsePayloadJson(args.payloadJson);
	const embed = await buildDiscordEmbedPayload(ctx, {
		input,
		destinationKind: args.destinationKind,
		userId: args.userId,
		payload,
	});
	return {
		title: embed.title,
		message: args.message,
		description: embed.description,
		url: buildDiscordNotificationUrl(args.entity),
		fields: embed.fields,
		author: embed.author,
		actions: await buildDiscordActionButtons(ctx, {
			type: args.type,
			entity: args.entity,
			destinationKind: args.destinationKind,
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
		destinationKind: "dm",
		userId: args.recipientId,
		title: args.input.title,
		message: args.input.message,
		priority: args.input.priority as "urgent" | "high" | "normal" | undefined,
		payloadJson: args.input.payloadJson,
		metadata: args.input.metadata,
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

	const message = await buildDiscordMessagePayload(ctx, {
		type: input.type,
		entity: input.entity,
		destinationKind: "channel",
		title: input.title,
		message: input.message,
		priority: input.priority as "urgent" | "high" | "normal" | undefined,
		payloadJson: input.payloadJson,
		metadata: input.metadata,
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

async function dispatchNotification(
	ctx: MutationCtx,
	input: NotificationEmitInput,
): Promise<boolean> {
	const recipients = await expandNotificationRecipientsByWatcherPolicy(
		ctx,
		input,
	);
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
	emitInput.forceRecipientDelivery = opts.forceRecipientDelivery;
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
		forceRecipientDelivery: args.forceRecipientDelivery,
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
		forceRecipientDelivery: args.forceRecipientDelivery,
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
		forceRecipientDelivery?: boolean;
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
			forceRecipientDelivery: args.forceRecipientDelivery,
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
	forceRecipientDelivery?: boolean;
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
		forceRecipientDelivery: args.forceRecipientDelivery,
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
				forceRecipientDelivery: args.forceRecipientDelivery,
			});
		case "due_date_overdue":
			return emitDueDateUrgencyNotification(ctx, "due_date_overdue", {
				taskId: args.taskId,
				assigneeId: args.assigneeId,
				days: args.daysOverdue,
				eventKey: args.eventKey,
				forceRecipientDelivery: args.forceRecipientDelivery,
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
		forceRecipientDelivery?: boolean;
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
		forceRecipientDelivery: args.forceRecipientDelivery,
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
