import { verifyKey } from "discord-interactions";
import {
	InteractionResponseType,
	InteractionType,
	type APIApplicationCommandInteraction,
	type APIInteraction,
	type APIInteractionResponse,
	type APIInteractionResponseCallbackData,
	type APIMessageComponentInteraction,
	type APIPingInteraction,
	type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { ButtonStyle, ComponentType } from "discord-api-types/v10";

export type DiscordInteractionRequest = {
	rawBody: string;
	signature: string | null;
	timestamp: string | null;
};

export const HQ_COMPETITIONS_COUNT_BUTTON_ID = "hq:competitions:count";
export const HQ_ACTION_TOKEN_PREFIX = "hqa:";

type DiscordMessageData = APIInteractionResponseCallbackData &
	RESTPostAPIChannelMessageJSONBody;

export async function verifyDiscordInteractionRequest(
	request: DiscordInteractionRequest,
	publicKey: string,
): Promise<boolean> {
	if (!request.signature || !request.timestamp) {
		return false;
	}

	return verifyKey(
		request.rawBody,
		request.signature,
		request.timestamp,
		publicKey,
	);
}

export function parseDiscordInteraction(rawBody: string): APIInteraction {
	return JSON.parse(rawBody) as APIInteraction;
}

export function interactionPongResponse(): APIInteractionResponse {
	return { type: InteractionResponseType.Pong };
}

export function interactionMessageResponse(
	data: APIInteractionResponseCallbackData,
	options?: { ephemeral?: boolean },
): APIInteractionResponse {
	return {
		type: InteractionResponseType.ChannelMessageWithSource,
		data: {
			...data,
			flags: options?.ephemeral ? 64 : data.flags,
		},
	};
}

export function interactionUpdateMessageResponse(
	data: APIInteractionResponseCallbackData,
): APIInteractionResponse {
	return {
		type: InteractionResponseType.UpdateMessage,
		data,
	};
}

export function buildCompetitionCountMessage(
	competitionCount?: number,
): DiscordMessageData {
	const description =
		typeof competitionCount === "number"
			? `Headquarters currently has **${competitionCount}** competitions.`
			: "Press the button below to fetch the current competition total from Headquarters.";

	return {
		content: "Headquarters Discord integration",
		embeds: [
			{
				title:
					typeof competitionCount === "number"
						? "Competition total"
						: "Interactive HQ controls",
				description,
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
						label:
							typeof competitionCount === "number"
								? "Refresh competition count"
								: "Fetch competition count",
						custom_id: HQ_COMPETITIONS_COUNT_BUTTON_ID,
					},
				],
			},
		],
	};
}

export function isPingInteraction(
	interaction: APIInteraction,
): interaction is APIPingInteraction {
	return interaction.type === InteractionType.Ping;
}

export function isChatInputCommand(
	interaction: APIInteraction,
): interaction is APIApplicationCommandInteraction {
	return interaction.type === InteractionType.ApplicationCommand;
}

export function isMessageComponent(
	interaction: APIInteraction,
): interaction is APIMessageComponentInteraction {
	return interaction.type === InteractionType.MessageComponent;
}
