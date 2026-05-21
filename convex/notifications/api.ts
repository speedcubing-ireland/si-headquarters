import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { buildNotificationEmitInput } from "./emit";
import {
	buildCompetitionNotificationResult,
	buildTaskNotificationResult,
	getActorInfo,
	resolveRecipientIds,
	type CompetitionNotificationBuildArgs,
	type TaskNotificationBuildArgs,
} from "./lib/notificationBuilders";
import { canUserAccessNotificationEntity } from "./lib/notificationAccess";
import {
	buildDueDateNotificationSpec,
	computeDueDateDaysDiff,
	MS_PER_DAY,
	type DueDateNotificationSpec,
} from "./lib/notificationDueDates";
import type { NotificationEmitInput } from "./lib/notificationTypes";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType as TemplateTaskNotificationType,
} from "./lib/notificationTemplates";
import { scheduleDiscordChannel, scheduleDiscordDm } from "./discord/delivery";
import { serializePayload } from "./lib/payload";
import { expandNotificationRecipientsByWatcherPolicy } from "./lib/watcherRecipients";

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
