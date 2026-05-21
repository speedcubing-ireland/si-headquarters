import { commentOnTaskAction, startTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import {
	labelForPriority,
	optionalPayloadString,
	requireTask,
	taskDescription,
} from "../utils";

export const taskPriorityChangedDiscordNotification = {
	type: "task_priority_changed",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		const oldPriority =
			optionalPayloadString(context, "oldPriority") ??
			context.input.metadata?.oldValue;
		const newPriority =
			optionalPayloadString(context, "newPriority") ??
			context.input.metadata?.newValue;
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: `:warning: Priority Changed - ${labelForPriority(newPriority)}`,
					value: `Changed from **${labelForPriority(
						oldPriority,
					)}** to **${labelForPriority(newPriority)}**.`,
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
