import { startTaskAction, viewTaskUrlAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import {
	normalizePayloadTaskId,
	optionalPayloadString,
	requireTask,
	taskDescription,
} from "../utils";

export const relationUnblockedDiscordNotification = {
	type: "relation_unblocked",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		const blockingTaskId = normalizePayloadTaskId(
			context.ctx,
			optionalPayloadString(context, "blockingTaskId"),
		);
		const blocker = blockingTaskId
			? await context.ctx.db.get("tasks", blockingTaskId)
			: null;
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":white_check_mark: Task Unblocked",
					value: blocker
						? `The blocker **${blocker.identifier}: ${blocker.title}** was resolved. This task can move again.`
						: "A blocker was resolved. This task can move again.",
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
			...(await startTaskAction(context)),
			...(blockingTaskId
				? viewTaskUrlAction(blockingTaskId, "View Former Blocker")
				: []),
		];
	},
} satisfies DiscordNotificationDefinition;
