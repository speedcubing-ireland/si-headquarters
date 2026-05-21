import { approveTaskAction, commentOnTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { requireTask, taskDescription } from "../utils";

export const taskUnapprovedDiscordNotification = {
	type: "task_unapproved",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":x: Approval Withdrawn",
					value: "This task is no longer fully approved.",
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: async (context) => [
		...(await approveTaskAction(context)),
		...(await commentOnTaskAction(context)),
	],
} satisfies DiscordNotificationDefinition;
