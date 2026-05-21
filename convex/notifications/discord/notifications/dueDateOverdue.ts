import { commentOnTaskAction, markDoneAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { optionalPayloadNumber, requireTask, taskDescription } from "../utils";

export const dueDateOverdueDiscordNotification = {
	type: "due_date_overdue",
	viewLabel: "View Task",
	buildEmbed: async (context) => {
		const task = requireTask(context);
		const days = optionalPayloadNumber(context, "daysOverdue");
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: `:rotating_light: Task Overdue${
						days ? ` - ${days} ${days === 1 ? "Day" : "Days"}` : ""
					}`,
					value: task.dueDate
						? `This task was due on **${task.dueDate.slice(0, 10)}**.`
						: "This task is overdue.",
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
