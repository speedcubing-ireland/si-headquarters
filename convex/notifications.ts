import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireUserId } from "./auth";

const toISO = (ms: number) => new Date(ms).toISOString();

const notificationReturns = v.object({
	id: v.string(),
	userId: v.string(),
	type: v.string(),
	priority: v.string(),
	status: v.union(
		v.literal("unread"),
		v.literal("read"),
		v.literal("archived"),
	),
	title: v.string(),
	message: v.string(),
	body: v.optional(v.string()),
	entityType: v.string(),
	entityId: v.string(),
	parentEntityId: v.optional(v.string()),
	metadata: v.optional(v.any()),
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
	metadata?: unknown;
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
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();
		return docs.map(docToNotification);
	},
});

export const getUnreadCount = query({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
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
		const userId = (await requireUserId(ctx)) as Id<"users">;
		const docs = await ctx.db
			.query("notifications")
			.withIndex("by_user_and_status", (q) =>
				q.eq("userId", userId).eq("status", "unread"),
			)
			.collect();
		const now = Date.now();
		await Promise.all(
			docs.map((d) =>
				ctx.db.patch("notifications", d._id, {
					status: "read",
					readAt: now,
				}),
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

export const create = mutation({
	args: {
		type: v.string(),
		priority: v.string(),
		title: v.string(),
		message: v.string(),
		body: v.optional(v.string()),
		entityType: v.string(),
		entityId: v.string(),
		parentEntityId: v.optional(v.string()),
		metadata: v.optional(v.any()),
		isBatchable: v.optional(v.boolean()),
		batchKey: v.optional(v.string()),
	},
	returns: v.id("notifications"),
	handler: async (ctx, args) => {
		const userId = (await requireUserId(ctx)) as Id<"users">;
		return await ctx.db.insert("notifications", {
			userId,
			type: args.type,
			priority: args.priority ?? "normal",
			status: "unread",
			title: args.title,
			message: args.message,
			body: args.body,
			entityType: args.entityType,
			entityId: args.entityId,
			parentEntityId: args.parentEntityId,
			metadata: args.metadata,
			isBatchable: args.isBatchable ?? false,
			batchKey: args.batchKey,
		});
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

const APPROACHING_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function getActorInfo(
	ctx: {
		db: {
			get: (
				table: "users",
				id: Id<"users">,
			) => Promise<{ name: string | null; image: string | null } | null>;
		};
	},
	actorId: Id<"users"> | null,
): Promise<{ actorId?: string; actorName?: string; actorAvatarUrl?: string }> {
	if (!actorId) return {};
	const user = await ctx.db.get("users", actorId);
	if (!user) return {};
	return {
		actorId: actorId,
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

export const _createNotification = internalMutation({
	args: {
		userId: v.id("users"),
		type: v.string(),
		priority: v.string(),
		title: v.string(),
		message: v.string(),
		body: v.optional(v.string()),
		entityType: v.string(),
		entityId: v.string(),
		parentEntityId: v.optional(v.string()),
		metadata: v.optional(v.any()),
		isBatchable: v.optional(v.boolean()),
		batchKey: v.optional(v.string()),
	},
	returns: v.id("notifications"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("notifications", {
			userId: args.userId,
			type: args.type,
			priority: args.priority,
			status: "unread",
			title: args.title,
			message: args.message,
			body: args.body,
			entityType: args.entityType,
			entityId: args.entityId,
			parentEntityId: args.parentEntityId,
			metadata: args.metadata,
			isBatchable: args.isBatchable ?? false,
			batchKey: args.batchKey,
		});
	},
});

export const _notifyTaskAssigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";

		return await ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "task_assigned",
			priority: getPriorityFromTaskPriority(task.priority),
			status: "unread",
			title: `Assigned to ${task.identifier}`,
			message: `${actorName} assigned you to task ${task.identifier}: ${task.title}`,
			entityType: "task",
			entityId: args.taskId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
			},
			isBatchable: false,
		});
	},
});

export const _notifyTaskUnassigned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		assigneeId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";

		return await ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "task_unassigned",
			priority: "normal",
			status: "unread",
			title: `Unassigned from ${task.identifier}`,
			message: `${actorName} unassigned you from task ${task.identifier}: ${task.title}`,
			entityType: "task",
			entityId: args.taskId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
			},
			isBatchable: false,
		});
	},
});

export const _notifyTaskMentioned = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		mentionedUserId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";

		return await ctx.db.insert("notifications", {
			userId: args.mentionedUserId,
			type: "task_mentioned",
			priority: "normal",
			status: "unread",
			title: `Mentioned in ${task.identifier}`,
			message: `${actorName} mentioned you in a comment on task ${task.identifier}: ${task.title}`,
			entityType: "comment",
			entityId: args.commentId,
			parentEntityId: args.taskId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
			},
			isBatchable: false,
		});
	},
});

export const _notifyCommentAdded = internalMutation({
	args: {
		taskId: v.id("tasks"),
		commentId: v.id("comments"),
		recipientId: v.id("users"),
		actorId: v.id("users"),
	},
	returns: v.union(v.id("notifications"), v.null()),
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";

		return await ctx.db.insert("notifications", {
			userId: args.recipientId,
			type: "comment_added",
			priority: "normal",
			status: "unread",
			title: `New comment on ${task.identifier}`,
			message: `${actorName} added a comment on task ${task.identifier}: ${task.title}`,
			entityType: "comment",
			entityId: args.commentId,
			parentEntityId: args.taskId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
			},
			isBatchable: false,
		});
	},
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
	handler: async (ctx, args) => {
		const task = await ctx.db.get("tasks", args.taskId);
		if (!task) return null;

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";
		const oldLabel = STATUS_LABELS[args.oldStatus] ?? args.oldStatus;
		const newLabel = STATUS_LABELS[args.newStatus] ?? args.newStatus;

		return await ctx.db.insert("notifications", {
			userId: args.recipientId,
			type: "task_status_changed",
			priority: "normal",
			status: "unread",
			title: `${task.identifier} status changed`,
			message: `${actorName} moved task ${task.identifier} from "${oldLabel}" to "${newLabel}": ${task.title}`,
			entityType: "task",
			entityId: args.taskId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
				oldValue: args.oldStatus,
				newValue: args.newStatus,
			},
			isBatchable: false,
		});
	},
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

		return await ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "due_date_approaching",
			priority: args.daysUntil <= 1 ? "high" : "normal",
			status: "unread",
			title: `${task.identifier} due soon`,
			message: `Task ${task.identifier}: ${task.title} is due in ${formatDaysText(args.daysUntil)}`,
			entityType: "task",
			entityId: args.taskId,
			metadata: {},
			isBatchable: true,
			batchKey: `due_date_${args.taskId}`,
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

		return await ctx.db.insert("notifications", {
			userId: args.assigneeId,
			type: "due_date_overdue",
			priority: "urgent",
			status: "unread",
			title: `${task.identifier} is overdue`,
			message: `Task ${task.identifier}: ${task.title} is ${formatDaysText(args.daysOverdue)} overdue`,
			entityType: "task",
			entityId: args.taskId,
			metadata: {},
			isBatchable: true,
			batchKey: `due_date_${args.taskId}`,
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

		const actorInfo = await getActorInfo(ctx, args.actorId);
		const actorName = actorInfo.actorName ?? "Someone";

		return await ctx.db.insert("notifications", {
			userId: args.recipientId,
			type: "competition_phase_changed",
			priority: "normal",
			status: "unread",
			title: `${competition.name} phase changed`,
			message: `${actorName} moved ${competition.name} from "${args.oldPhaseName}" to "${args.newPhaseName}"`,
			entityType: "competition",
			entityId: args.competitionId,
			metadata: {
				actorId: args.actorId,
				actorName: actorInfo.actorName,
				actorAvatarUrl: actorInfo.actorAvatarUrl,
				oldValue: args.oldPhaseName,
				newValue: args.newPhaseName,
			},
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
		const taskTitle = task ? `${task.identifier}: ${task.title}` : args.taskId;

		return await ctx.db.insert("notifications", {
			userId: args.userId,
			type: "reminder_triggered",
			priority: getPriorityFromTaskPriority(reminder.priority),
			status: "unread",
			title: `Reminder: ${taskTitle}`,
			message: args.message ?? `Reminder for task ${taskTitle}`,
			entityType: "reminder",
			entityId: args.reminderId,
			parentEntityId: args.taskId,
			metadata: {},
			isBatchable: false,
		});
	},
});

async function hasExistingDueDateNotification(
	ctx: MutationCtx,
	userId: Id<"users">,
	taskId: Id<"tasks">,
	type: "due_date_overdue" | "due_date_approaching",
): Promise<boolean> {
	const notifications = await ctx.db
		.query("notifications")
		.withIndex("by_user_and_status", (q) =>
			q.eq("userId", userId).eq("status", "unread"),
		)
		.collect();

	return notifications.some(
		(n) =>
			n.type === type &&
			n.entityId === taskId &&
			n.batchKey === `due_date_${taskId}`,
	);
}

async function createOverdueNotification(
	ctx: MutationCtx,
	task: {
		_id: Id<"tasks">;
		identifier: string;
		title: string;
		assigneeId?: Id<"users">;
	},
	daysOverdue: number,
): Promise<void> {
	if (!task.assigneeId) return;

	await ctx.db.insert("notifications", {
		userId: task.assigneeId,
		type: "due_date_overdue",
		priority: "urgent",
		status: "unread",
		title: `${task.identifier} is overdue`,
		message: `Task ${task.identifier}: ${task.title} is ${formatDaysText(daysOverdue)} overdue`,
		entityType: "task",
		entityId: task._id,
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	});
}

async function createApproachingNotification(
	ctx: MutationCtx,
	task: {
		_id: Id<"tasks">;
		identifier: string;
		title: string;
		assigneeId?: Id<"users">;
	},
	daysUntil: number,
): Promise<void> {
	if (!task.assigneeId) return;

	await ctx.db.insert("notifications", {
		userId: task.assigneeId,
		type: "due_date_approaching",
		priority: daysUntil <= 1 ? "high" : "normal",
		status: "unread",
		title: `${task.identifier} due soon`,
		message: `Task ${task.identifier}: ${task.title} is due in ${formatDaysText(daysUntil)}`,
		entityType: "task",
		entityId: task._id,
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	});
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
					await createOverdueNotification(ctx, task, daysOverdue);
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
					await createApproachingNotification(ctx, task, daysDiff);
					notificationCount++;
				}
			}
		}

		return notificationCount;
	},
});
