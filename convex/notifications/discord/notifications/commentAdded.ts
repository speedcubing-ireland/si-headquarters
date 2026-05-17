import { replyToCommentAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { requireTask, taskDescription, truncateDiscordPreview } from "../utils";

export const commentAddedDiscordNotification = {
	type: "comment_added",
	viewLabel: "View Comment",
	buildEmbed: async (context) => {
		requireTask(context);
		const preview = truncateDiscordPreview(context.comment?.content);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":speech_balloon: New Comment",
					value: preview
						? `**${context.actorName}:** ${preview}`
						: `${context.actorName} added a comment.`,
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
	buildActions: replyToCommentAction,
} satisfies DiscordNotificationDefinition;
