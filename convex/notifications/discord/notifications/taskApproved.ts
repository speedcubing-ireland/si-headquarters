import { unapproveTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { requireTask, taskDescription } from "../utils";

export const taskApprovedDiscordNotification = {
	type: "task_approved",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		const task = requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":thumbsup: Task Approved",
					value:
						task.status === "awaiting-review"
							? "This task received an approval."
							: "This task received an approval. If all approvals are complete, it may now be done.",
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: unapproveTaskAction,
} satisfies DiscordNotificationDefinition;
