import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import type { notificationMetadata, notificationPriority } from "./validators";
import {
	STATUS_LABELS,
	PRIORITY_LABELS,
	PROGRESS_STATUS_LABELS,
} from "./constants";

type NotificationPriority = Infer<typeof notificationPriority>;
type NotificationMetadata = Infer<typeof notificationMetadata>;
type NotificationEntityType = "task" | "comment" | "competition" | "reminder";

export type TaskInfo = Pick<
	Doc<"tasks">,
	"_id" | "identifier" | "title" | "priority"
>;
export type CompetitionInfo = Pick<Doc<"competitions">, "_id" | "name">;
export type ActorInfo = {
	actorId?: Id<"users">;
	actorName?: string;
	actorAvatarUrl?: string;
};

export type NotificationTemplateConfig = {
	title: string;
	message: string;
	priority: NotificationPriority;
	entityType: NotificationEntityType;
	parentTaskId?: Id<"tasks">;
	metadata?: NotificationMetadata;
	body?: string;
	isBatchable?: boolean;
	batchKey?: string;
};

export type TaskNotificationType =
	| "task_assigned"
	| "task_unassigned"
	| "task_mentioned"
	| "comment_added"
	| "comment_replied"
	| "task_status_changed"
	| "task_priority_changed"
	| "task_awaiting_review"
	| "task_approved"
	| "task_unapproved"
	| "due_date_changed"
	| "relation_blocked"
	| "relation_unblocked";

export function formatDaysText(days: number): string {
	return days === 1 ? "1 day" : `${days} days`;
}

export function getPriorityFromTaskPriority(
	taskPriority: Doc<"tasks">["priority"],
): "urgent" | "high" | "normal" {
	if (taskPriority === "urgent") return "urgent";
	if (taskPriority === "high") return "high";
	return "normal";
}

export const NotificationTemplates = {
	task_assigned: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `Assigned to ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} assigned you to task ${task.identifier}: ${task.title}`,
		priority: getPriorityFromTaskPriority(task.priority),
		entityType: "task",
		metadata: actor,
	}),

	task_unassigned: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `Unassigned from ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} unassigned you from task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	task_mentioned: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `Mentioned in ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} mentioned you in a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "comment",
		parentTaskId: task._id,
		metadata: actor,
	}),

	comment_added: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `New comment on ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} added a comment on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "comment",
		parentTaskId: task._id,
		metadata: actor,
	}),

	comment_replied: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `New reply on ${task.identifier}`,
		message: `${actor.actorName ?? "Someone"} replied to your comment on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "comment",
		parentTaskId: task._id,
		metadata: actor,
	}),

	task_status_changed: (
		task: TaskInfo,
		actor: ActorInfo,
		oldStatus: string,
		newStatus: string,
	): NotificationTemplateConfig => {
		const oldLabel = STATUS_LABELS[oldStatus] ?? oldStatus;
		const newLabel = STATUS_LABELS[newStatus] ?? newStatus;
		return {
			title: `${task.identifier} status changed`,
			message: `${actor.actorName ?? "Someone"} moved task ${task.identifier} from "${oldLabel}" to "${newLabel}": ${task.title}`,
			priority: "normal",
			entityType: "task",
			metadata: { ...actor, oldValue: oldStatus, newValue: newStatus },
		};
	},

	task_priority_changed: (
		task: TaskInfo,
		actor: ActorInfo,
		oldPriority: string,
		newPriority: string,
	): NotificationTemplateConfig => {
		const oldLabel = PRIORITY_LABELS[oldPriority] ?? oldPriority;
		const newLabel = PRIORITY_LABELS[newPriority] ?? newPriority;
		return {
			title: `${task.identifier} priority changed`,
			message: `${actor.actorName ?? "Someone"} changed priority for task ${task.identifier} from "${oldLabel}" to "${newLabel}": ${task.title}`,
			priority: "normal",
			entityType: "task",
			metadata: { ...actor, oldValue: oldPriority, newValue: newPriority },
		};
	},

	task_awaiting_review: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} awaiting your review`,
		message: `${actor.actorName ?? "Someone"} marked task ${task.identifier} as awaiting review: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	relation_blocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${blockedTask.identifier} is blocked`,
		message: `${actor.actorName ?? "Someone"} blocked ${blockedTask.identifier} with ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "high",
		entityType: "task",
		metadata: {
			...actor,
			oldValue: blockingTask.identifier,
		},
	}),

	relation_unblocked: (
		blockedTask: TaskInfo,
		blockingTask: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${blockedTask.identifier} is unblocked`,
		message: `${actor.actorName ?? "Someone"} unblocked ${blockedTask.identifier} by resolving ${blockingTask.identifier}: ${blockingTask.title}`,
		priority: "normal",
		entityType: "task",
		metadata: {
			...actor,
			newValue: blockingTask.identifier,
		},
	}),

	task_approved: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} approved`,
		message: `${actor.actorName ?? "Someone"} approved task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	task_unapproved: (
		task: TaskInfo,
		actor: ActorInfo,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} approval withdrawn`,
		message: `${actor.actorName ?? "Someone"} withdrew approval on task ${task.identifier}: ${task.title}`,
		priority: "normal",
		entityType: "task",
		metadata: actor,
	}),

	due_date_changed: (
		task: TaskInfo,
		actor: ActorInfo,
		oldDate: string | undefined,
		newDate: string | undefined,
	): NotificationTemplateConfig => {
		let description: string;
		if (!oldDate && newDate) {
			description = `set due date to ${newDate}`;
		} else if (oldDate && !newDate) {
			description = `removed due date (was ${oldDate})`;
		} else {
			description = `changed due date from ${oldDate} to ${newDate}`;
		}
		return {
			title: `${task.identifier} due date changed`,
			message: `${actor.actorName ?? "Someone"} ${description} on task ${task.identifier}: ${task.title}`,
			priority: "normal",
			entityType: "task",
			metadata: { ...actor, oldValue: oldDate, newValue: newDate },
		};
	},

	due_date_approaching: (
		task: TaskInfo,
		daysUntil: number,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} due soon`,
		message: `Task ${task.identifier}: ${task.title} is due in ${formatDaysText(daysUntil)}`,
		priority: daysUntil <= 1 ? "high" : "normal",
		entityType: "task",
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	due_date_overdue: (
		task: TaskInfo,
		daysOverdue: number,
	): NotificationTemplateConfig => ({
		title: `${task.identifier} is overdue`,
		message: `Task ${task.identifier}: ${task.title} is ${formatDaysText(daysOverdue)} overdue`,
		priority: "urgent",
		entityType: "task",
		metadata: {},
		isBatchable: true,
		batchKey: `due_date_${task._id}`,
	}),

	competition_phase_changed: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		oldPhase: string,
		newPhase: string,
	): NotificationTemplateConfig => ({
		title: `${competition.name} phase changed`,
		message: `${actor.actorName ?? "Someone"} moved ${competition.name} from "${oldPhase}" to "${newPhase}"`,
		priority: "normal",
		entityType: "competition",
		metadata: { ...actor, oldValue: oldPhase, newValue: newPhase },
	}),

	progress_update_added: (
		competition: CompetitionInfo,
		actor: ActorInfo,
		status: string,
	): NotificationTemplateConfig => {
		const statusLabel = PROGRESS_STATUS_LABELS[status] ?? status;
		return {
			title: `Progress update: ${competition.name}`,
			message: `${actor.actorName ?? "Someone"} posted a ${statusLabel} update for ${competition.name}`,
			priority: "normal",
			entityType: "competition",
			metadata: { ...actor, newValue: status },
		};
	},

	reminder_triggered: (
		taskId: Id<"tasks">,
		message?: string,
	): NotificationTemplateConfig => ({
		title: `Reminder for task ${taskId}`,
		message: message ?? `Reminder for task ${taskId}`,
		priority: "normal",
		entityType: "reminder",
		parentTaskId: taskId,
		metadata: {},
	}),
};
