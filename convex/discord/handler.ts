import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type {
	APIApplicationCommandInteraction,
	APIInteraction,
} from "discord-api-types/v10";
import {
	buildCompetitionCountMessage,
	HQ_ACTION_TOKEN_PREFIX,
	HQ_COMPETITIONS_COUNT_BUTTON_ID,
	interactionMessageResponse,
	interactionPongResponse,
	interactionUpdateMessageResponse,
	isChatInputCommand,
	isMessageComponent,
	isPingInteraction,
} from "./interactions";

export async function handleDiscordInteraction(
	ctx: ActionCtx,
	interaction: APIInteraction,
): Promise<Response> {
	if (isPingInteraction(interaction)) {
		return jsonResponse(interactionPongResponse());
	}

	if (isChatInputCommand(interaction)) {
		if (interaction.data.name === "ping") {
			return jsonResponse(
				interactionMessageResponse({
					content: "Pong from Headquarters.",
				}),
			);
		}

		if (interaction.data.name === "dmhq") {
			const userId = getDiscordInteractionUserId(interaction);
			if (!userId) {
				return jsonResponse(
					interactionMessageResponse(
						{
							content: "Could not determine which Discord user to DM.",
						},
						{ ephemeral: true },
					),
				);
			}

			await ctx.runAction(
				internal.discord.actions.sendCompetitionSummaryDmAction,
				{
					userId,
				},
			);

			return jsonResponse(
				interactionMessageResponse(
					{
						content: "Sent you an interactive Headquarters DM.",
					},
					{ ephemeral: true },
				),
			);
		}

		return jsonResponse(
			interactionMessageResponse({
				content: `Unknown command: ${interaction.data.name}`,
			}),
		);
	}

	if (isMessageComponent(interaction)) {
		const customId = interaction.data.custom_id;
		if (customId === HQ_COMPETITIONS_COUNT_BUTTON_ID) {
			const competitionCount: number = await ctx.runQuery(
				internal.competitions.api.countInternal,
				{},
			);
			return jsonResponse(
				interactionUpdateMessageResponse({
					...buildCompetitionCountMessage(competitionCount),
				}),
			);
		}

		if (customId.startsWith(HQ_ACTION_TOKEN_PREFIX)) {
			const discordUserId = getDiscordInteractionUserId(interaction);
			if (!discordUserId) {
				return jsonResponse(
					interactionMessageResponse(
						{
							content:
								"Could not determine which Discord user clicked this action.",
						},
						{ ephemeral: true },
					),
				);
			}

			const result = await ctx.runMutation(
				internal.discord.api.executeActionToken,
				{
					token: customId.slice(HQ_ACTION_TOKEN_PREFIX.length),
					discordUserId,
				},
			);
			return jsonResponse(
				interactionUpdateMessageResponse({
					content: result.content,
					components: result.clearMessage ? [] : interaction.message.components,
				}),
			);
		}

		return jsonResponse(
			interactionUpdateMessageResponse({
				content: `Unknown button: ${customId}`,
				components: [],
			}),
		);
	}

	return jsonResponse(
		interactionMessageResponse({
			content: "This interaction type is not handled yet.",
		}),
	);
}

function getDiscordInteractionUserId(
	interaction: APIApplicationCommandInteraction | APIInteraction,
): string | null {
	if ("member" in interaction && interaction.member?.user?.id) {
		return interaction.member.user.id;
	}

	if ("user" in interaction && interaction.user?.id) {
		return interaction.user.id;
	}

	return null;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
