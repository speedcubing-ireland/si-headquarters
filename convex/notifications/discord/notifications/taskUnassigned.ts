import { commentOnTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { taskDescription, requireTask } from "../utils";

export const taskUnassignedDiscordNotification = {
	type: "task_unassigned",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":busts_in_silhouette: Task Unassigned",
					value:
						context.destinationKind === "dm"
							? "You were unassigned from this task."
							: `${context.actorName} removed the assignee from this task.`,
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: commentOnTaskAction,
} satisfies DiscordNotificationDefinition;
