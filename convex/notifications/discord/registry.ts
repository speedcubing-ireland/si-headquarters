import type { NotificationType } from "../lib/notificationTypes";
import type { DiscordNotificationDefinition } from "./types";
import {
	commentAddedDiscordNotification,
	commentRepliedDiscordNotification,
	competitionPhaseChangedDiscordNotification,
	dueDateApproachingDiscordNotification,
	dueDateChangedDiscordNotification,
	dueDateOverdueDiscordNotification,
	progressUpdateAddedDiscordNotification,
	relationBlockedDiscordNotification,
	relationUnblockedDiscordNotification,
	reminderTriggeredDiscordNotification,
	taskApprovedDiscordNotification,
	taskAssignedDiscordNotification,
	taskAwaitingReviewDiscordNotification,
	taskMentionedDiscordNotification,
	taskPriorityChangedDiscordNotification,
	taskStatusChangedDiscordNotification,
	taskUnapprovedDiscordNotification,
	taskUnassignedDiscordNotification,
} from "./notifications";

export const discordNotificationRegistry: Record<
	NotificationType,
	DiscordNotificationDefinition
> = {
	task_assigned: taskAssignedDiscordNotification,
	task_unassigned: taskUnassignedDiscordNotification,
	task_mentioned: taskMentionedDiscordNotification,
	task_status_changed: taskStatusChangedDiscordNotification,
	task_priority_changed: taskPriorityChangedDiscordNotification,
	task_awaiting_review: taskAwaitingReviewDiscordNotification,
	due_date_approaching: dueDateApproachingDiscordNotification,
	due_date_overdue: dueDateOverdueDiscordNotification,
	comment_added: commentAddedDiscordNotification,
	comment_replied: commentRepliedDiscordNotification,
	relation_blocked: relationBlockedDiscordNotification,
	relation_unblocked: relationUnblockedDiscordNotification,
	task_approved: taskApprovedDiscordNotification,
	task_unapproved: taskUnapprovedDiscordNotification,
	due_date_changed: dueDateChangedDiscordNotification,
	competition_phase_changed: competitionPhaseChangedDiscordNotification,
	progress_update_added: progressUpdateAddedDiscordNotification,
	reminder_triggered: reminderTriggeredDiscordNotification,
};
