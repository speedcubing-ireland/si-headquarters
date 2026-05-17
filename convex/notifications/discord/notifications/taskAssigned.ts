import { commentOnTaskAction, startTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { taskDescription, requireTask } from "../utils";

export const taskAssignedDiscordNotification = {
	type: "task_assigned",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":bust_in_silhouette: Task Assigned",
					value:
						context.destinationKind === "dm"
							? "You were assigned to this task."
							: `${context.actorName} assigned this task.`,
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: async (context) => [
		...(await startTaskAction(context)),
		...(await commentOnTaskAction(context)),
	],
} satisfies DiscordNotificationDefinition;
