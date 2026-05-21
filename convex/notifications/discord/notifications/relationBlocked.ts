import { commentOnTaskAction, viewTaskUrlAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import {
	normalizePayloadTaskId,
	optionalPayloadString,
	requireTask,
	taskDescription,
} from "../utils";

export const relationBlockedDiscordNotification = {
	type: "relation_blocked",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":construction: Task Blocked",
					value:
						"This task is blocked. This notification type is disabled by default.",
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: async (context) => {
		const blockingTaskId = normalizePayloadTaskId(
			context.ctx,
			optionalPayloadString(context, "blockingTaskId"),
		);
		return [
			...(blockingTaskId
				? viewTaskUrlAction(blockingTaskId, "View Blocker")
				: []),
			...(await commentOnTaskAction(context)),
		];
	},
} satisfies DiscordNotificationDefinition;
