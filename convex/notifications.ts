import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireUserId } from "./auth";
import type { Infer } from "convex/values";
import { notificationStatus, notificationMetadata } from "./lib/validators";

const toISO = (ms: number) => new Date(ms).toISOString();

type NotificationMetadata = Infer<typeof notificationMetadata>;

export const notificationReturns = v.object({
	id: v.string(),
	userId: v.string(),
	type: v.string(),
	priority: v.string(),
	status: notificationStatus,
	title: v.string(),
	message: v.string(),
	body: v.optional(v.string()),
	entityType: v.string(),
	entityId: v.string(),
	parentEntityId: v.optional(v.string()),
	metadata: notificationMetadata,
	createdAt: v.string(),
	readAt: v.optional(v.string()),
	archivedAt: v.optional(v.string()),
	scheduledFor: v.optional(v.string()),
	isBatchable: v.boolean(),
	batchKey: v.optional(v.string()),
});

function docToNotification(d: {
	_id: Id<"notifications">;
	_creationTime: number;
	userId: Id<"users">;
	type: string;
	priority: string;
	status: "unread" | "read" | "archived";
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	metadata?: NotificationMetadata;
	readAt?: number;
	archivedAt?: number;
	scheduledFor?: number;
	isBatchable: boolean;
	batchKey?: string;
}) {
	return {
		id: d._id,
		userId: d.userId,
		type: d.type,
		priority: d.priority,
		status: d.status,
		title: d.title,
		message: d.message,
		body: d.body,
		entityType: d.entityType,
		entityId: d.entityId,
		parentEntityId: d.parentEntityId,
		metadata: d.metadata ?? {},
		createdAt: toISO(d._creationTime),
		readAt: d.readAt !== undefined ? toISO(d.readAt) : undefined,
		archivedAt: d.archivedAt !== undefined ? toISO(d.archivedAt) : undefined,
		scheduledFor:
			d.scheduledFor !== undefined ? toISO(d.scheduledFor) : undefined,
		isBatchable: d.isBatchable,
		batchKey: d.batchKey,
	};
}

export const listForUser = query({
	args: {},
	returns: v.array(notificationReturns),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.take(200);
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();
		return docs.length;
	},
});

export const markRead = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId || doc.status !== "unread") return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "read",
			readAt: Date.now(),
		});
		return null;
	},
});

export const markArchived = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) return null;
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			archivedAt: Date.now(),
			readAt: doc.readAt ?? Date.now(),
		});
		return null;
	},
});

export const markAllRead = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();
		const now = Date.now();
		await Promise.all(
			docs.map((d) =>
				ctx.db.patch("notifications", d._id, { status: "read", readAt: now }),
			),
		);
		return null;
	},
});

export const dismiss = mutation({
	args: { notificationId: v.id("notifications") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const doc = await ctx.db.get("notifications", args.notificationId);
		if (!doc || doc.userId !== userId) return null;
		const now = Date.now();
		await ctx.db.patch("notifications", args.notificationId, {
			status: "archived",
			readAt: doc.readAt ?? now,
			archivedAt: now,
		});
		return null;
	},
});

const STATUS_LABELS: Record<string, string> = {
	backlog: "Backlog",
	"to-do": "To Do",
	"in-progress": "In Progress",
	"awaiting-review": "Awaiting Review",
	done: "Done",
	cancelled: "Cancelled",
};

const PROGRESS_STATUS_LABELS: Record<string, string> = {
	"on-track": "On track",
	"at-risk": "At risk",
	"off-track": "Off track",
};

async function getActorInfo(
	ctx: Pick<MutationCtx, "db">,
	actorId: Id<"users"> | null,
): Promise<{
	actorId?: Id<"users">;
	actorName?: string;
	actorAvatarUrl?: string;
}> {
	if (!actorId) return {};
	const user = await ctx.db.get("users", actorId);
	if (!user) return {};
	return {
		actorId,
		actorName: user.name ?? undefined,
		actorAvatarUrl: user.image ?? undefined,
	};
}

function formatDaysText(days: number): string {
	return days === 1 ? "1 day" : `${days} days`;
}

function getPriorityFromTaskPriority(
	taskPriority: string,
): "urgent" | "high" | "normal" {
	if (taskPriority === "urgent") return "urgent";
	if (taskPriority === "high") return "high";
	return "normal";
}

type NotificationEntityType = "task" | "comment" | "competition";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

type TaskInfo = Pick<Doc<"tasks">, "_id" | "identifier" | "title" | "priority">;
type CompetitionInfo = Pick<Doc<"competitions">, "_id" | "name">;
type ActorInfo = {
	actorId?: Id<"users">;
	actorName?: string;
	actorAvatarUrl?: string;
};

const NotificationTemplates = {
	task_assigned: (task: TaskInfo, actor: ActorInfo) => ({
		title: `Assigned to ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} assigned you to task ${task.identifier}: ${task.title}`,
		priority: getPriorityFromTaskPriority(task.priority),
		entityType: "task" as NotificationEntityType,
		metadata: actor,
	}),

	task_unassigned: (task: TaskInfo, actor: ActorInfo) => ({
		title: `Unassigned from ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} unassigned you from task ${task.identifier}: ${task.title}`,
		priority: "normal" as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: actor,
	}),

	task_mentioned: (
		task: TaskInfo,
		actor: ActorInfo,
		_commentId: Id<"comments">,
	) => ({
		title: `Mentioned in ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} mentioned you in a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal" as NotificationPriority,
		entityType: "comment" as NotificationEntityType,
		parentEntityId: task._id,
		metadata: actor,
	}),

	comment_added: (
		task: TaskInfo,
		actor: ActorInfo,
		_commentId: Id<"comments">,
	) => ({
		title: `New comment on ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} added a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal" as NotificationPriority,
		entityType: "comment" as NotificationEntityType,
		parentEntityId: task._id,
		metadata: actor,
	}),

	task_status_changed: (
		task: TaskInfo,
		actor: ActorInfo,
		oldStatus: string,
		newStatus: string,
	) => {
		const oldLabel = STATUS_LABELS[oldStatus] ?? oldStatus;
		const newLabel = STATUS_LABELS[newStatus] ?? newStatus;
		return {
			title: `${task.identifier} status changed`,
			message: `${actor.actorName ?? "Someone"} moved task ${task.identifier} from "${oldLabel}" to "${newLabel}": ${task.title}`,
			priority: "normal" as NotificationPriority,
			entityType: "task" as NotificationEntityType,
			metadata: { ...actor, oldValue: oldStatus, newValue: newStatus },
		};
	},

	task_awaiting_review: (task: TaskInfo, actor: ActorInfo) => ({
		title: `${task.identifier} awaiting your review`,
		message: `${actor.actorName ?? "Someone"} marked task ${task.identifier} as awaiting review: ${task.title}`,
		priority: "normal" as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: actor,
	}),

	relation_blocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	) => ({
		title: `${blockedTask.identifier} is blocked`,
		message: `${actor.actorName ?? "Someone"} blocked ${blockedTask.identifier} with ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "high" as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: {
			...actor,
			oldValue: blockingTask.identifier,
		},
	}),

	relation_unblocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	) => ({
		title: `${blockedTask.identifier} is unblocked`,
		message: `${actor.actorName ?? "Someone"} unblocked ${blockedTask.identifier} by resolving ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "normal" as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: {
			...actor,
			newValue: blockingTask.identifier,
		},
	}),

	due_date_approaching: (task: TaskInfo, daysUntil: number) => ({
		title: `${task.identifier} due soon`,
		message: `Task ${task.identifier}: ${task.title} is due in ${formatDaysText(daysUntil)}`,
		priority: (daysUntil <= 1 ? "high" : "normal") as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	due_date_overdue: (task: TaskInfo, daysOverdue: number) => ({
		title: `${task.identifier} is overdue`,
		message: `Task ${task.identifier}: ${task.title} is ${formatDaysText(daysOverdue)} overdue`,
		priority: "urgent" as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	competition_phase_changed: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		oldPhase: string,
		newPhase: string,
	) => ({
		title: `${competition.name} phase changed`,
		message: `${actor.actorName ?? "Someone"} moved ${competition.name} from "${oldPhase}" to "${newPhase}"`,
		priority: "normal" as NotificationPriority,
		entityType: "competition" as NotificationEntityType,
		metadata: { ...actor, oldValue: oldPhase, newValue: newPhase },
	}),

	progress_update_added: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		status: string,
	) => {
		const statusLabel = PROGRESS_STATUS_LABELS[status] ?? status;
		return {
			title: `Progress update: ${competition.name}`,
			message: `${actor.actorName ?? "Someone"} posted a ${statusLabel} update for ${competition.name}`,
			priority: "normal" as NotificationPriority,
			entityType: "competition" as NotificationEntityType,
			metadata: { ...actor, newValue: status },
		};
	},

	reminder_triggered: (
		task: TaskInfo | null,
		taskId: string,
		message?: string,
	) => ({
		title: `Reminder: ${task ? `${task.identifier}: ${task.title}` : taskId}`,
		message:
			message ??
			`Reminder for task ${task ? `${task.identifier}: ${task.title}` : taskId}`,
		priority: (task
			? getPriorityFromTaskPriority(task.priority)
			: "normal") as NotificationPriority,
		entityType: "task" as NotificationEntityType,
		parentEntityId: taskId,
		metadata: {},
	}),
};

type TaskNotificationType =
	| "task_assigned"
	| "task_unassigned"
	| "task_mentioned"
	| "comment_added"
	| "task_status_changed"
	| "task_awaiting_review"
	| "relation_blocked"
	| "relation_unblocked";

async function createTaskNotification(
	ctx: MutationCtx,
	type: TaskNotificationType,
	args: {
		taskId: Id<"tasks">;
		recipientId: Id<"users">;
		actorId: Id<"users">;
		commentId?: Id<"comments">;
		oldStatus?: string;
		newStatus?: string;
		blockingTaskId?: Id<"tasks">;
	},
): Promise<Id<"notifications"> | null> {
	const task = await ctx.db.get("tasks", args.taskId);
	if (!task) return null;

	const actor = await getActorInfo(ctx, args.actorId);
	const template = NotificationTemplates[type];

	let config: ReturnType<typeof template>;
	if (type === "task_mentioned" || type === "comment_added") {
		const commentId = args.commentId;
		if (commentId === undefined) return null;
		config = (
			template as (
				task: TaskInfo,
				actor: ActorInfo,
				commentId: Id<"comments">,
			) => ReturnType<typeof template>
		)(task, actor, commentId);
	} else if (type === "task_status_changed") {
		config = (
			template as (
				task: TaskInfo,
				actor: ActorInfo,
				oldStatus: string,
				newStatus: string,
			) => ReturnType<typeof template>
		)(task, actor, args.oldStatus as string, args.newStatus as string);
	} else if (type === "relation_blocked" || type === "relation_unblocked") {
		if (!args.blockingTaskId) return null;
		const blockingTask = await ctx.db.get("tasks", args.blockingTaskId);
		if (!blockingTask) return null;
		config = (
			template as (
				blockedTask: TaskInfo,
				blockingTask: TaskInfo,
				actor: ActorInfo,
			) => ReturnType<typeof template>
		)(task, blockingTask, actor);
	} else {
		config = (
			template as (
				task: TaskInfo,
				actor: ActorInfo,
			) => ReturnType<typeof template>
		)(task, actor);
	}

	return ctx.db.insert("notifications", {
		userId: args.recipientId,
		type,
		status: "unread",
		entityId: args.taskId,
		isBatchable: false,
		...config,
	});
}

export const _notifyTaskAssigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_assigned", {
			taskId: args.taskId,
			recipientId: args.assigneeId,
			actorId: args.actorId,
		}),
});

export const _notifyTaskUnassigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_unassigned", {
			taskId: args.taskId,
			recipientId: args.assigneeId,
			actorId: args.actorId,
		}),
});

export const _notifyTaskMentioned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		mentionedUserId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_mentioned", {
			...args,
			recipientId: args.mentionedUserId,
		}),
});

export const _notifyCommentAdded = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "comment_added", args),
});

export const _notifyTaskStatusChanged = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
		oldStatus: v.string(),
		newStatus: v.string(),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_status_changed", args),
});

export const _notifyTaskAwaitingReview = internalMutation({
	args: {
		taskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "task_awaiting_review", args),
});

export const _notifyTaskRelationBlocked = internalMutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_blocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
			actorId: args.actorId,
		}),
});

export const _notifyTaskRelationUnblocked = internalMutation({
	args: {
		blockedTaskId: v.id("tasks"),
		blockingTaskId: v.id("tasks"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) =>
		createTaskNotification(ctx, "relation_unblocked", {
			taskId: args.blockedTaskId,
			blockingTaskId: args.blockingTaskId,
			recipientId: args.recipientId,
			actorId: args.actorId,
		}),
});

export const _notifyDueDateApproaching = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysUntil: v.number(),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task?.dueDate) return null;

		const config = NotificationTemplates.due_date_approaching(
			task,
			args.daysUntil,
		);
		return ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "due_date_approaching",
			status: "unread",
			entityId: args.taskId,
			...config,
		});
	},
});

export const _notifyDueDateOverdue = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		daysOverdue: v.number(),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task?.dueDate) return null;

		const config = NotificationTemplates.due_date_overdue(
			task,
			args.daysOverdue,
		);
		return ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "due_date_overdue",
			status: "unread",
			entityId: args.taskId,
			...config,
		});
	},
});

export const _notifyCompetitionPhaseChanged = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
		oldPhaseName: v.string(),
		newPhaseName: v.string(),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const competition = await ctx.db.get("competitions", args.competitionId);
		if (!competition) return null;

		const actor = await getActorInfo(ctx, args.actorId);
		const config = NotificationTemplates.competition_phase_changed(
			competition,
			actor,
			args.oldPhaseName,
			args.newPhaseName,
		);

		return ctx.db.insert("notifications", {
			userId: args.recipientId,
			type: "competition_phase_changed",
			status: "unread",
			entityId: args.competitionId,
			...config,
			isBatchable: false,
		});
	},
});

export const _notifyProgressUpdateAdded = internalMutation({
	args: {
		competitionId: v.id("competitions"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
		competitionName: v.string(),
		status: v.union(
			v.literal("on-track"),
			v.literal("at-risk"),
			v.literal("off-track"),
		),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const actor = await getActorInfo(ctx, args.actorId);
		const config = NotificationTemplates.progress_update_added(
			{ _id: args.competitionId, name: args.competitionName },
			actor,
			args.status,
		);

		return ctx.db.insert("notifications", {
			userId: args.recipientId,
			type: "progress_update_added",
			status: "unread",
			entityId: args.competitionId,
			...config,
			isBatchable: false,
		});
	},
});

export const _notifyReminderTriggered = internalMutation({
	args: {
		reminderId: v.id("reminders"),
		userId: v.id("users"),
		taskId: v.string(),
		message: v.optional(v.string()),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const reminder = await ctx.db.get("reminders", args.reminderId);
		if (!reminder) return null;

		const task = await ctx.db.get("tasks", args.taskId as Id<"tasks">);
		const config = NotificationTemplates.reminder_triggered(
			task ?? null,
			args.taskId,
			args.message,
		);

		return ctx.db.insert("notifications", {
			userId: args.userId,
			type: "reminder_triggered",
			status: "unread",
			entityId: args.reminderId,
			...config,
			isBatchable: false,
		});
	},
});

import { NOTIFICATION_THRESHOLDS } from "./lib/constants";

const { APPROACHING_MS: APPROACHING_THRESHOLD_MS, MS_PER_DAY } =
	NOTIFICATION_THRESHOLDS;

async function hasExistingDueDateNotification(
	ctx: MutationCtx,
	userId: Id<"users">,
	taskId: Id<"tasks">,
	type: "due_date_overdue" | "due_date_approaching",
): Promise<boolean> {
	const notifications = await ctx.db
		.query("notifications")
		.withIndex("by_entity", (q) =>
			q.eq("entityType", "task").eq("entityId", taskId),
		)
		.collect();
	return notifications.some(
		(n) =>
			n.userId === userId &&
			n.type === type &&
			n.status === "unread" &&
			n.batchKey === `due_date_${taskId}`,
	);
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
			if (!task.dueDate || !task.assigneeId || task.status === "done") continue;

			const dueDateMs = new Date(task.dueDate).getTime();
			const diffMs = dueDateMs - now;
			const daysDiff = Math.floor(diffMs / MS_PER_DAY);

			if (diffMs < 0) {
				const daysOverdue = Math.abs(daysDiff);
				const hasExisting = await hasExistingDueDateNotification(
					ctx,
					task.assigneeId,
					task._id,
					"due_date_overdue",
				);
				if (!hasExisting) {
					const config = NotificationTemplates.due_date_overdue(
						task,
						daysOverdue,
					);
					await ctx.db.insert("notifications", {
						userId: task.assigneeId,
						type: "due_date_overdue",
						status: "unread",
						entityId: task._id,
						...config,
					});
					notificationCount++;
				}
			} else if (diffMs <= APPROACHING_THRESHOLD_MS && diffMs > 0) {
				const hasExisting = await hasExistingDueDateNotification(
					ctx,
					task.assigneeId,
					task._id,
					"due_date_approaching",
				);
				if (!hasExisting) {
					const config = NotificationTemplates.due_date_approaching(
						task,
						daysDiff,
					);
					await ctx.db.insert("notifications", {
						userId: task.assigneeId,
						type: "due_date_approaching",
						status: "unread",
						entityId: task._id,
						...config,
					});
					notificationCount++;
				}
			}
		}

		return notificationCount;
	},
});
