import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
	type TaskNotificationType,
	type TaskInfo,
	type ActorInfo,
} from "./notificationTemplates";
import type {
	NotificationEntityRef,
	NotificationPayload,
} from "./notificationTypes";

export async function getActorInfo(
	ctx: Pick<MutationCtx, "db">,
	actorId: Id<"users"> | null | undefined,
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

export type TaskNotificationBuildArgs = {
	taskId: Id<"tasks">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	actorId: Id<"users">;
	commentId?: Id<"comments">;
	oldStatus?: string;
	newStatus?: string;
	oldPriority?: string;
	newPriority?: string;
	oldDueDate?: string;
	newDueDate?: string;
	blockingTaskId?: Id<"tasks">;
	eventKey?: string;
};

export type TaskNotificationBuildResult = {
	config: NotificationTemplateConfig;
	entity: NotificationEntityRef;
	payload: NotificationPayload;
};

export type CompetitionNotificationBuildArgs = {
	type: "competition_phase_changed" | "progress_update_added";
	competitionId: Id<"competitions">;
	updateId?: Id<"competitionUpdates">;
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
	actorId: Id<"users">;
	oldPhaseName?: string;
	newPhaseName?: string;
	competitionName?: string;
	status?: "on-track" | "at-risk" | "off-track";
	eventKey?: string;
};

export type CompetitionNotificationBuildResult = {
	config: NotificationTemplateConfig;
	payload: NotificationPayload;
};

export function resolveRecipientIds(args: {
	recipientId?: Id<"users">;
	recipientIds?: Id<"users">[];
}): Id<"users">[] {
	const recipientSet = new Set<Id<"users">>();
	if (args.recipientId) {
		recipientSet.add(args.recipientId);
	}
	if (args.recipientIds) {
		for (const recipientId of args.recipientIds) {
			recipientSet.add(recipientId);
		}
	}
	return [...recipientSet];
}

export function buildCommentEntity(
	taskId: Id<"tasks">,
	commentId: Id<"comments">,
): NotificationEntityRef {
	return {
		entityType: "comment",
		entityId: commentId,
		parentTaskId: taskId,
	};
}

type SimpleTaskActorTemplate = (
	task: TaskInfo,
	actor: ActorInfo,
) => NotificationTemplateConfig;

const SIMPLE_TASK_TYPES = new Set<TaskNotificationType>([
	"task_assigned",
	"task_unassigned",
	"task_awaiting_review",
	"task_approved",
	"task_unapproved",
]);
const COMMENT_ENTITY_TYPES = new Set<TaskNotificationType>([
	"task_mentioned",
	"comment_added",
	"comment_replied",
]);

export async function buildTaskNotificationResult(
	ctx: MutationCtx,
	type: TaskNotificationType,
	task: Doc<"tasks">,
	actor: Awaited<ReturnType<typeof getActorInfo>>,
	args: TaskNotificationBuildArgs,
	basePayload: NotificationPayload,
): Promise<TaskNotificationBuildResult | null> {
	const taskEntity: NotificationEntityRef = {
		entityType: "task",
		entityId: task._id,
	};

	if (SIMPLE_TASK_TYPES.has(type)) {
		return {
			config: (NotificationTemplates[type] as SimpleTaskActorTemplate)(
				task,
				actor,
			),
			entity: taskEntity,
			payload: basePayload,
		};
	}

	if (COMMENT_ENTITY_TYPES.has(type)) {
		if (!args.commentId) return null;
		return {
			config: (NotificationTemplates[type] as SimpleTaskActorTemplate)(
				task,
				actor,
			),
			entity: buildCommentEntity(task._id, args.commentId),
			payload: { ...basePayload, commentId: args.commentId },
		};
	}

	if (type === "task_status_changed") {
		if (args.oldStatus === undefined || args.newStatus === undefined)
			return null;
		return {
			config: NotificationTemplates.task_status_changed(
				task,
				actor,
				args.oldStatus,
				args.newStatus,
			),
			entity: taskEntity,
			payload: {
				...basePayload,
				oldStatus: args.oldStatus,
				newStatus: args.newStatus,
			},
		};
	}

	if (type === "task_priority_changed") {
		if (args.oldPriority === undefined || args.newPriority === undefined)
			return null;
		return {
			config: NotificationTemplates.task_priority_changed(
				task,
				actor,
				args.oldPriority,
				args.newPriority,
			),
			entity: taskEntity,
			payload: {
				...basePayload,
				oldPriority: args.oldPriority,
				newPriority: args.newPriority,
			},
		};
	}

	if (type === "due_date_changed") {
		return {
			config: NotificationTemplates.due_date_changed(
				task,
				actor,
				args.oldDueDate,
				args.newDueDate,
			),
			entity: taskEntity,
			payload: {
				...basePayload,
				oldDueDate: args.oldDueDate,
				newDueDate: args.newDueDate,
			},
		};
	}

	if (type === "relation_blocked" || type === "relation_unblocked") {
		if (!args.blockingTaskId) return null;
		const blockingTask = await ctx.db.get("tasks", args.blockingTaskId);
		if (!blockingTask) return null;
		return {
			config:
				type === "relation_blocked"
					? NotificationTemplates.relation_blocked(task, blockingTask, actor)
					: NotificationTemplates.relation_unblocked(task, blockingTask, actor),
			entity: taskEntity,
			payload: {
				...basePayload,
				blockingTaskId: args.blockingTaskId,
			},
		};
	}

	return null;
}

export function buildCompetitionNotificationResult(
	competition: Doc<"competitions">,
	actor: Awaited<ReturnType<typeof getActorInfo>>,
	args: CompetitionNotificationBuildArgs,
	basePayload: NotificationPayload,
): CompetitionNotificationBuildResult | null {
	if (args.type === "competition_phase_changed") {
		if (!args.oldPhaseName || !args.newPhaseName) {
			return null;
		}
		return {
			config: NotificationTemplates.competition_phase_changed(
				competition,
				actor,
				args.oldPhaseName,
				args.newPhaseName,
			),
			payload: {
				...basePayload,
				oldPhaseName: args.oldPhaseName,
				newPhaseName: args.newPhaseName,
			},
		};
	}

	if (!args.competitionName || !args.status) {
		return null;
	}
	return {
		config: NotificationTemplates.progress_update_added(
			{ _id: competition._id, name: args.competitionName },
			actor,
			args.status,
		),
		payload: {
			...basePayload,
			competitionName: args.competitionName,
			status: args.status,
		},
	};
}
