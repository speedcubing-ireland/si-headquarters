import { markDoneAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { truncateDiscordPreview } from "../utils";

export const reminderTriggeredDiscordNotification = {
	type: "reminder_triggered",
	viewLabel: "View Task",
	buildEmbed: async (context) => ({
		title: context.competition?.name ?? context.input.title,
		description: context.task
			? `**${context.task.identifier}: ${context.task.title}**`
			: undefined,
		fields: [
			{
				name: ":alarm_clock: Reminder",
				value:
					truncateDiscordPreview(context.input.message) ||
					(context.task
						? `Reminder for **${context.task.identifier}: ${context.task.title}**.`
						: "Reminder triggered."),
				inline: false,
			},
		],
	}),
	buildActions: markDoneAction,
} satisfies DiscordNotificationDefinition;
