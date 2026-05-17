import { approveTaskAction, commentOnTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { requireTask, taskDescription } from "../utils";

export const taskAwaitingReviewDiscordNotification = {
	type: "task_awaiting_review",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":mag: Task Awaiting Review",
					value: "This task is ready for review.",
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
