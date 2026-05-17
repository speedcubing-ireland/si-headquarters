import { commentOnTaskAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { optionalPayloadString, requireTask, taskDescription } from "../utils";

export const dueDateChangedDiscordNotification = {
	type: "due_date_changed",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		const oldDate =
			optionalPayloadString(context, "oldDueDate") ??
			context.input.metadata?.oldValue;
		const newDate =
			optionalPayloadString(context, "newDueDate") ??
			context.input.metadata?.newValue;
		const value =
			!oldDate && newDate
				? `Set to **${newDate}**.`
				: oldDate && !newDate
					? `Removed due date, previously **${oldDate}**.`
					: `Changed from **${oldDate ?? "none"}** to **${newDate ?? "none"}**.`;
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [{ name: ":calendar: Due Date Changed", value, inline: false }],
			author: context.actorAuthor,
		};
	},
	buildActions: commentOnTaskAction,
} satisfies DiscordNotificationDefinition;
