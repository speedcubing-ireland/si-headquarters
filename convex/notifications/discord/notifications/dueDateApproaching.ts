import { commentOnTaskAction, markDoneAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { optionalPayloadNumber, requireTask, taskDescription } from "../utils";

export const dueDateApproachingDiscordNotification = {
	type: "due_date_approaching",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		requireTask(context);
		const days =
			optionalPayloadNumber(context, "daysUntil") ??
			optionalPayloadNumber(context, "daysDiff");
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name:
						days === 0 ? ":alarm_clock: Due Today" : ":alarm_clock: Due Soon",
					value:
						days === 0
							? "This task is due **today**."
							: `This task is due in **${days ?? "a few"} days**.`,
					inline: false,
				},
			],
		};
	},
	buildActions: async (context) => [
		...(await markDoneAction(context)),
		...(await commentOnTaskAction(context)),
	],
} satisfies DiscordNotificationDefinition;
