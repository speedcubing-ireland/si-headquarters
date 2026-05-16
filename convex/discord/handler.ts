import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type {
	APIApplicationCommandInteraction,
	APIInteraction,
} from "discord-api-types/v10";
import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import {
	buildCompetitionCountMessage,
	HQ_COMPETITIONS_COUNT_BUTTON_ID,
	interactionMessageResponse,
	interactionModalResponse,
	interactionPongResponse,
	interactionUpdateMessageResponse,
	isChatInputCommand,
	isMessageComponent,
	isModalSubmitInteraction,
	isPingInteraction,
	extractModalTextValue,
	PING_ECHO_BUTTON_ID,
	PING_ECHO_MODAL_ID,
	PING_ECHO_MODAL_TEXT_ID,
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
					content: "Pong from headquarters",
					embeds: [
						{
							title: "Pong",
							description: "Headquarters Discord integration is online",
							color: 0x5865f2,
						},
					],
					components: [
						{
							type: ComponentType.ActionRow,
							components: [
								{
									type: ComponentType.Button,
									style: ButtonStyle.Primary,
									label: "Echo",
									custom_id: PING_ECHO_BUTTON_ID,
								},
							],
						},
					],
				}),
			);
		}

		if (interaction.data.name === "dmhq") {
			const userId = getInteractionUserId(interaction);
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

		if (customId === PING_ECHO_BUTTON_ID) {
			return jsonResponse(
				interactionModalResponse({
					custom_id: PING_ECHO_MODAL_ID,
					title: "Echo",
					components: [
						{
							type: ComponentType.ActionRow,
							components: [
								{
									type: ComponentType.TextInput,
									custom_id: PING_ECHO_MODAL_TEXT_ID,
									style: 1,
									label: "Type something to echo:",
									required: true,
								},
							],
						},
					],
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

	if (isModalSubmitInteraction(interaction)) {
		if (interaction.data.custom_id === PING_ECHO_MODAL_ID) {
			const text = extractModalTextValue(interaction, PING_ECHO_MODAL_TEXT_ID);
			return jsonResponse(
				interactionMessageResponse({
					content: text ?? "Nothing was entered.",
				}),
			);
		}

		return jsonResponse(
			interactionMessageResponse({
				content: `Unknown modal: ${interaction.data.custom_id}`,
			}),
		);
	}

	return jsonResponse(
		interactionMessageResponse({
			content: "This interaction type is not handled yet.",
		}),
	);
}

function getInteractionUserId(
	interaction: APIApplicationCommandInteraction,
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
