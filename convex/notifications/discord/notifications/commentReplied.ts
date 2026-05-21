import { replyToCommentAction } from "../actions";
import type { DiscordNotificationDefinition } from "../types";
import { requireTask, taskDescription, truncateDiscordPreview } from "../utils";

export const commentRepliedDiscordNotification = {
	type: "comment_replied",
	viewLabel: "View Comment",
	buildEmbed: async (context) => {
		requireTask(context);
		const preview = truncateDiscordPreview(context.comment?.content);
		return {
			title: context.competition?.name ?? context.input.title,
			description: taskDescription(context),
			fields: [
				{
					name: ":left_speech_bubble: Reply to Your Comment",
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
