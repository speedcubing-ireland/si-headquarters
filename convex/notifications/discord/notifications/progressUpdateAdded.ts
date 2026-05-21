import { PROGRESS_STATUS_LABELS } from "../../../lib/constants";
import type { DiscordNotificationDefinition } from "../types";
import {
	optionalPayloadString,
	progressStatusIcon,
	truncateDiscordPreview,
} from "../utils";

export const progressUpdateAddedDiscordNotification = {
	type: "progress_update_added",
	viewLabel: "View Update",
	buildEmbed: async (context) => {
		const status =
			optionalPayloadString(context, "status") ??
			context.input.metadata?.newValue;
		const statusLabel = status
			? (PROGRESS_STATUS_LABELS[status] ?? status)
			: "Update";
		return {
			title: context.competition?.name ?? context.input.title,
			fields: [
				{
					name: `${progressStatusIcon(status)} Update Posted - ${statusLabel}`,
					value:
						truncateDiscordPreview(context.progressUpdate?.message) ||
						"A progress update was posted.",
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
} satisfies DiscordNotificationDefinition;
