import {
	approveTaskAction,
	commentOnTaskAction,
	unapproveTaskAction,
} from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import {
	labelForStatus,
	optionalPayloadString,
	requireTask,
	taskDescription,
} from "../utils";

export const taskStatusChangedDiscordNotification = {
	type: "task_status_changed",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		const oldStatus =
			optionalPayloadString(context, "oldStatus") ??
			context.input.metadata?.oldValue;
		const newStatus =
			optionalPayloadString(context, "newStatus") ??
			context.input.metadata?.newValue;
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: `:arrows_counterclockwise: Status Changed - ${labelForStatus(
						newStatus,
					)}`,
					value: `Moved from **${labelForStatus(
						oldStatus,
					)}** to **${labelForStatus(newStatus)}**.`,
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: async (context) => {
		const newStatus = optionalPayloadString(context, "newStatus");
		if (newStatus === "awaiting-review") {
			return [
				...(await approveTaskAction(context)),
				...(await commentOnTaskAction(context)),
			];
		}
		if (newStatus === "done") {
			return unapproveTaskAction(context);
		}
		return commentOnTaskAction(context);
	},
} satisfies DiscordNotificationDefinition;
