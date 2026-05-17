import type { DiscordNotificationDefinition } from "../types";
import { optionalPayloadString } from "../utils";

export const competitionPhaseChangedDiscordNotification = {
	type: "competition_phase_changed",
	viewLabel: "View Competition",
	buildEmbed: async (context) => {
		const oldPhase =
			optionalPayloadString(context, "oldPhaseName") ??
			context.input.metadata?.oldValue;
		const newPhase =
			optionalPayloadString(context, "newPhaseName") ??
			context.input.metadata?.newValue;
		return {
			title: context.competition?.name ?? context.input.title,
			fields: [
				{
					name: `:twisted_rightwards_arrows: Phase Changed - ${
						newPhase ?? "Updated"
					}`,
					value: `Moved from **${oldPhase ?? "Unknown"}** to **${
						newPhase ?? "Unknown"
					}**.`,
					inline: false,
				},
			],
			author: context.actorAuthor,
		};
	},
} satisfies DiscordNotificationDefinition;
